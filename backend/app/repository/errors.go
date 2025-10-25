package repository

import "errors"

var (
	ErrUserNotFound         = errors.New("user not found")
	ErrEmailAlreadyUsed     = errors.New("email already exists")
	ErrSessionNotFound      = errors.New("session not found")
	ErrProviderAlreadyLinked = errors.New("provider already linked to another account")
)
