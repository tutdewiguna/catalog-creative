package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"devara-creative-backend/app/database"
	"devara-creative-backend/app/models"

	"github.com/jackc/pgconn"
	"gorm.io/gorm"
)

type UserRepository interface {
	CreateLocalUser(ctx context.Context, email, name, passwordHash string) (*models.User, error)
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	FindByID(ctx context.Context, id uint) (*models.User, error)
	RecordUserLogin(ctx context.Context, id uint, loginAt time.Time) (*models.User, error)
	UpsertOAuthUser(ctx context.Context, email, name, picture, provider, providerID string, loginAt time.Time) (*models.User, error)
	AttachOAuthProvider(ctx context.Context, userID uint, email, name, picture, provider, providerID string, loginAt time.Time) (*models.User, error)
	DetachOAuthProvider(ctx context.Context, userID uint, provider string) error
	ListAuthProviders(ctx context.Context, userID uint) ([]models.AuthProvider, error)
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) CreateLocalUser(ctx context.Context, email, name, passwordHash string) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if strings.TrimSpace(passwordHash) == "" {
		return nil, fmt.Errorf("password hash is required")
	}
	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		if at := strings.Index(email, "@"); at > 0 {
			cleanName = email[:at]
		} else {
			cleanName = email
		}
	}
	now := time.Now().UTC()
	user := database.User{
		Email:        email,
		Name:         cleanName,
		PasswordHash: passwordHash,
		LastLoginAt:  now,
	}
	if err := r.db.WithContext(ctx).Create(&user).Error; err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailAlreadyUsed
		}
		return nil, err
	}
	return mapDatabaseUser(&user), nil
}

func (r *userRepository) FindByID(ctx context.Context, id uint) (*models.User, error) {
	var user database.User
	if err := r.db.WithContext(ctx).First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return mapDatabaseUser(&user), nil
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user database.User
	err := r.db.WithContext(ctx).
		Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(email))).
		First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return mapDatabaseUser(&user), nil
}

func (r *userRepository) RecordUserLogin(ctx context.Context, id uint, loginAt time.Time) (*models.User, error) {
	loginAt = loginAt.UTC()
	if loginAt.IsZero() {
		loginAt = time.Now().UTC()
	}
	if err := r.db.WithContext(ctx).
		Model(&database.User{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"last_login_at": loginAt,
			"updated_at":    time.Now().UTC(),
		}).Error; err != nil {
		return nil, err
	}
	var user database.User
	if err := r.db.WithContext(ctx).First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return mapDatabaseUser(&user), nil
}

func (r *userRepository) UpsertOAuthUser(ctx context.Context, email, name, picture, provider, providerID string, loginAt time.Time) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	provider = strings.ToLower(strings.TrimSpace(provider))
	providerID = strings.TrimSpace(providerID)
	if provider == "" || providerID == "" {
		return nil, fmt.Errorf("provider data is required")
	}
	if loginAt.IsZero() {
		loginAt = time.Now().UTC()
	}

	var result *models.User
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var providerRec database.AuthProvider
		err := tx.Where("provider = ? AND provider_id = ?", provider, providerID).First(&providerRec).Error
		if err == nil {
			var user database.User
			if err := tx.First(&user, providerRec.UserID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrUserNotFound
				}
				return err
			}
			if err := updateUserProfile(tx, &user, strings.TrimSpace(name), strings.TrimSpace(picture), loginAt); err != nil {
				return err
			}
			update := map[string]any{
				"email":      email,
				"linked_at":  loginAt,
				"updated_at": time.Now().UTC(),
			}
			if err := tx.Model(&database.AuthProvider{}).Where("id = ?", providerRec.ID).Updates(update).Error; err != nil {
				return err
			}
			result = mapDatabaseUser(&user)
			return nil
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var user database.User
		err = tx.Where("LOWER(email) = ?", email).First(&user).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				user = database.User{
					Email:       email,
					Name:        strings.TrimSpace(name),
					AvatarURL:   strings.TrimSpace(picture),
					LastLoginAt: loginAt,
				}
				if err := tx.Create(&user).Error; err != nil {
					if isUniqueViolation(err) {
						return ErrEmailAlreadyUsed
					}
					return err
				}
			} else {
				return err
			}
		} else {
			if err := updateUserProfile(tx, &user, strings.TrimSpace(name), strings.TrimSpace(picture), loginAt); err != nil {
				return err
			}
		}

		rec := database.AuthProvider{
			UserID:     user.ID,
			Provider:   provider,
			ProviderID: providerID,
			Email:      email,
			LinkedAt:   loginAt,
			CreatedAt:  time.Now().UTC(),
			UpdatedAt:  time.Now().UTC(),
		}
		if err := tx.Where("user_id = ? AND provider = ?", user.ID, provider).
			Assign(map[string]any{
				"provider_id": providerID,
				"email":       email,
				"linked_at":   loginAt,
				"updated_at":  time.Now().UTC(),
			}).FirstOrCreate(&rec).Error; err != nil {
			return err
		}

		result = mapDatabaseUser(&user)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (r *userRepository) AttachOAuthProvider(ctx context.Context, userID uint, email, name, picture, provider, providerID string, loginAt time.Time) (*models.User, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	providerID = strings.TrimSpace(providerID)
	email = strings.ToLower(strings.TrimSpace(email))
	if provider == "" || providerID == "" {
		return nil, fmt.Errorf("provider data is required")
	}
	if loginAt.IsZero() {
		loginAt = time.Now().UTC()
	}

	var result *models.User
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var providerRec database.AuthProvider
		err := tx.Where("provider = ? AND provider_id = ?", provider, providerID).First(&providerRec).Error
		if err == nil && providerRec.UserID != userID {
			return ErrProviderAlreadyLinked
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var user database.User
		if err := tx.First(&user, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}

		if err := updateUserProfile(tx, &user, strings.TrimSpace(name), strings.TrimSpace(picture), loginAt); err != nil {
			return err
		}

		rec := database.AuthProvider{
			UserID:     user.ID,
			Provider:   provider,
			ProviderID: providerID,
			Email:      email,
			LinkedAt:   loginAt,
			CreatedAt:  time.Now().UTC(),
			UpdatedAt:  time.Now().UTC(),
		}
		if err := tx.Where("user_id = ? AND provider = ?", user.ID, provider).
			Assign(map[string]any{
				"provider_id": providerID,
				"email":       email,
				"linked_at":   loginAt,
				"updated_at":  time.Now().UTC(),
			}).FirstOrCreate(&rec).Error; err != nil {
			return err
		}

		result = mapDatabaseUser(&user)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (r *userRepository) DetachOAuthProvider(ctx context.Context, userID uint, provider string) error {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		return fmt.Errorf("provider is required")
	}
	return r.db.WithContext(ctx).
		Where("user_id = ? AND provider = ?", userID, provider).
		Delete(&database.AuthProvider{}).Error
}

func (r *userRepository) ListAuthProviders(ctx context.Context, userID uint) ([]models.AuthProvider, error) {
	var records []database.AuthProvider
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("provider").Find(&records).Error; err != nil {
		return nil, err
	}
	providers := make([]models.AuthProvider, 0, len(records))
	for _, rec := range records {
		providers = append(providers, mapDatabaseAuthProvider(&rec))
	}
	return providers, nil
}

func updateUserProfile(tx *gorm.DB, user *database.User, name, picture string, loginAt time.Time) error {
	updates := map[string]any{
		"last_login_at": loginAt,
		"updated_at":    time.Now().UTC(),
	}
	if name != "" && user.Name != name {
		updates["name"] = name
		user.Name = name
	}
	if picture != "" && user.AvatarURL != picture {
		updates["avatar_url"] = picture
		user.AvatarURL = picture
	}
	user.LastLoginAt = loginAt
	user.UpdatedAt = time.Now().UTC()
	return tx.Model(user).Updates(updates).Error
}

func mapDatabaseAuthProvider(src *database.AuthProvider) models.AuthProvider {
	if src == nil {
		return models.AuthProvider{}
	}
	return models.AuthProvider{
		Provider:   src.Provider,
		ProviderID: src.ProviderID,
		Email:      src.Email,
		LinkedAt:   src.LinkedAt,
	}
}
func isUniqueViolation(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return false
}

func mapDatabaseUser(src *database.User) *models.User {
	if src == nil {
		return nil
	}
	provider := "local"
	providerID := fmt.Sprintf("local-%d", src.ID)
	if len(src.AuthProviders) > 0 {
		provider = src.AuthProviders[0].Provider
		providerID = src.AuthProviders[0].ProviderID
	}
	return &models.User{
		ID:           src.ID,
		Email:        src.Email,
		Name:         src.Name,
		Picture:      src.AvatarURL,
		Provider:     provider,
		ProviderID:   providerID,
		PasswordHash: src.PasswordHash,
		CreatedAt:    src.CreatedAt,
		UpdatedAt:    src.UpdatedAt,
		LastLogin:    src.LastLoginAt,
	}
}
