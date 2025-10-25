package repository

import (
	"context"
	"errors"
	"time"

	"devara-creative-backend/app/database"
	"devara-creative-backend/app/models"

	"gorm.io/gorm"
)

type SessionRepository interface {
	Create(ctx context.Context, session *models.Session) error
	Get(ctx context.Context, tokenID string) (*models.Session, error)
	Delete(ctx context.Context, tokenID string) error
	DeleteByUser(ctx context.Context, userID uint) error
	UpdateLastSeen(ctx context.Context, tokenID string, seenAt time.Time) error
}

type sessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) SessionRepository {
	return &sessionRepository{db: db}
}

func (r *sessionRepository) Create(ctx context.Context, session *models.Session) error {
	entity := database.Session{
		UserID:         session.UserID,
		RefreshTokenID: session.RefreshTokenID,
		UserAgent:      session.UserAgent,
		IPAddress:      session.IPAddress,
		ExpiresAt:      session.ExpiresAt,
		LastSeenAt:     session.LastSeenAt,
	}
	return r.db.WithContext(ctx).Create(&entity).Error
}

func (r *sessionRepository) Get(ctx context.Context, tokenID string) (*models.Session, error) {
	var entity database.Session
	err := r.db.WithContext(ctx).Where("refresh_token_id = ?", tokenID).First(&entity).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return mapDatabaseSession(&entity), nil
}

func (r *sessionRepository) Delete(ctx context.Context, tokenID string) error {
	return r.db.WithContext(ctx).Where("refresh_token_id = ?", tokenID).Delete(&database.Session{}).Error
}

func (r *sessionRepository) DeleteByUser(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&database.Session{}).Error
}

func (r *sessionRepository) UpdateLastSeen(ctx context.Context, tokenID string, seenAt time.Time) error {
	return r.db.WithContext(ctx).
		Model(&database.Session{}).
		Where("refresh_token_id = ?", tokenID).
		Updates(map[string]any{
			"last_seen_at": seenAt,
			"updated_at":   time.Now().UTC(),
		}).Error
}

func mapDatabaseSession(entity *database.Session) *models.Session {
	if entity == nil {
		return nil
	}
	return &models.Session{
		RefreshTokenID: entity.RefreshTokenID,
		UserID:         entity.UserID,
		UserAgent:      entity.UserAgent,
		IPAddress:      entity.IPAddress,
		ExpiresAt:      entity.ExpiresAt,
		LastSeenAt:     entity.LastSeenAt,
		CreatedAt:      entity.CreatedAt,
		UpdatedAt:      entity.UpdatedAt,
	}
}
