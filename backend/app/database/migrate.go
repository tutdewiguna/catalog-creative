package database

import "gorm.io/gorm"

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&AuthProvider{},
		&EmailVerification{},
		&PasswordReset{},
		&TwoFATOTP{},
		&RecoveryCode{},
		&Session{},
	)
}
