package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

func secretKey() []byte {
	key := os.Getenv("JWT_SECRET")
	if key == "" {
		key = "change-me-secret"
	}
	return []byte(key)
}

func passwordSalt() string {
	salt := os.Getenv("PASSWORD_SALT")
	if salt == "" {
		salt = "creative-catalog"
	}
	return salt
}

func HashPassword(password string) string {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return legacyHashPassword(password)
	}
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 2, 32)
	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hash)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", 64*1024, 1, 2, encodedSalt, encodedHash)
}

func CheckPassword(hash, password string) bool {
	if strings.HasPrefix(hash, "$argon2id$") {
		params, salt, decodedHash, err := decodeArgonHash(hash)
		if err != nil {
			return false
		}
		computed := argon2.IDKey([]byte(password), salt, params.Time, params.Memory, params.Threads, uint32(len(decodedHash)))
		return subtle.ConstantTimeCompare(decodedHash, computed) == 1
	}
	return hmac.Equal([]byte(hash), []byte(legacyHashPassword(password)))
}

func GenerateToken(subject string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = 6 * time.Hour
	}
	payload := fmt.Sprintf("%s|%d", strings.ToLower(subject), time.Now().Add(ttl).Unix())
	sig := sign(payload)
	token := base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(sig)
	return token, nil
}

func ValidateToken(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", errors.New("invalid token")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", err
	}
	expected := sign(string(payloadBytes))
	if !hmac.Equal(sig, expected) {
		return "", errors.New("invalid token signature")
	}
	payloadParts := strings.Split(string(payloadBytes), "|")
	if len(payloadParts) != 2 {
		return "", errors.New("invalid token payload")
	}
	subject := payloadParts[0]
	expiryUnix, err := parseUnix(payloadParts[1])
	if err != nil {
		return "", err
	}
	if time.Now().Unix() > expiryUnix {
		return "", errors.New("token expired")
	}
	return subject, nil
}

func sign(payload string) []byte {
	mac := hmac.New(sha256.New, secretKey())
	mac.Write([]byte(payload))
	return mac.Sum(nil)
}

func parseUnix(value string) (int64, error) {
	var ts int64
	_, err := fmt.Sscan(value, &ts)
	return ts, err
}

type argonParams struct {
	Memory  uint32
	Time    uint32
	Threads uint8
}

func decodeArgonHash(encodedHash string) (*argonParams, []byte, []byte, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return nil, nil, nil, errors.New("invalid argon2 hash format")
	}

	var params argonParams
	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &params.Memory, &params.Time, &params.Threads)
	if err != nil {
		return nil, nil, nil, err
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, nil, nil, err
	}
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, nil, nil, err
	}
	return &params, salt, hash, nil
}

func legacyHashPassword(password string) string {
	hash := sha256.Sum256([]byte(passwordSalt() + password))
	return hex.EncodeToString(hash[:])
}
