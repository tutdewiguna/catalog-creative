package auth

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"devara-creative-backend/app/models"
	"devara-creative-backend/app/repository"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   string `json:"uid"`
	UserType string `json:"typ"`
	jwt.RegisteredClaims
}

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func getJwtExpireMinutes() time.Duration {
	expireMinutesStr := os.Getenv("JWT_EXPIRE_MINUTES")
	expireMinutes, err := strconv.Atoi(expireMinutesStr)
	if err != nil || expireMinutes <= 0 {
		expireMinutes = 360
	}
	return time.Duration(expireMinutes) * time.Minute
}

func CreateToken(user models.User, userRepo repository.UserRepository) (string, time.Time, error) {
	expirationTime := time.Now().Add(getJwtExpireMinutes())
	claims := &Claims{
		UserID:   fmt.Sprintf("%d", user.ID),
		UserType: "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "devara-creative-backend",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expirationTime, nil
}

func CreateAdminToken(admin models.Admin) (string, time.Time, error) {
	expirationTime := time.Now().Add(getJwtExpireMinutes())
	claims := &Claims{
		UserID:   fmt.Sprintf("%d", admin.ID),
		UserType: "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "devara-creative-backend",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expirationTime, nil
}

func ValidateToken(tokenString string) (*Claims, error) {
	if tokenString == "" {
		return nil, fmt.Errorf("token string is empty")
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}
