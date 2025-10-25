package database

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey"`
	Email        string    `gorm:"size:255;uniqueIndex"`
	Name         string    `gorm:"size:255"`
	PasswordHash string    `gorm:"size:255"`
	AvatarURL    string    `gorm:"size:512"`
	LastLoginAt  time.Time `gorm:"index"`
	CreatedAt    time.Time
	UpdatedAt    time.Time

	AuthProviders []AuthProvider `gorm:"constraint:OnDelete:CASCADE"`
	Sessions      []Session      `gorm:"constraint:OnDelete:CASCADE"`
	TwoFATOTP     []TwoFATOTP    `gorm:"constraint:OnDelete:CASCADE"`
	RecoveryCodes []RecoveryCode `gorm:"constraint:OnDelete:CASCADE"`
}

type AuthProvider struct {
	ID           uint      `gorm:"primaryKey"`
	UserID       uint      `gorm:"index;not null"`
	Provider     string    `gorm:"size:32;index:idx_provider_unique,priority:1;not null"`
	ProviderID   string    `gorm:"size:255;index:idx_provider_unique,priority:2;not null"`
	Email        string    `gorm:"size:255"`
	AccessToken  string    `gorm:"size:1024"`
	RefreshToken string    `gorm:"size:1024"`
	LinkedAt     time.Time `gorm:"index"`
	ExpiresAt    *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type EmailVerification struct {
	ID         uint      `gorm:"primaryKey"`
	UserID     uint      `gorm:"index;not null"`
	Token      string    `gorm:"size:255;uniqueIndex"`
	ExpiresAt  time.Time `gorm:"index"`
	ConsumedAt *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type PasswordReset struct {
	ID              uint      `gorm:"primaryKey"`
	UserID          uint      `gorm:"index;not null"`
	Token           string    `gorm:"size:255;uniqueIndex"`
	ExpiresAt       time.Time `gorm:"index"`
	ConsumedAt      *time.Time
	RequestedFromIP string `gorm:"size:64"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type TwoFATOTP struct {
	ID        uint   `gorm:"primaryKey"`
	UserID    uint   `gorm:"index;not null"`
	Secret    string `gorm:"size:255"`
	Issuer    string `gorm:"size:255"`
	EnabledAt *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type RecoveryCode struct {
	ID        uint   `gorm:"primaryKey"`
	UserID    uint   `gorm:"index;not null"`
	Code      string `gorm:"size:255"`
	UsedAt    *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Session struct {
	ID             uint      `gorm:"primaryKey"`
	UserID         uint      `gorm:"index;not null"`
	RefreshTokenID string    `gorm:"size:255;uniqueIndex"`
	UserAgent      string    `gorm:"size:512"`
	IPAddress      string    `gorm:"size:64"`
	ExpiresAt      time.Time `gorm:"index"`
	LastSeenAt     time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
