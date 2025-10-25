package database

import (
	"fmt"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

type Config struct {
	DSN          string
	MaxIdleConns int
	MaxOpenConns int
	MaxIdleTime  time.Duration
	MaxLifeTime  time.Duration
}

func LoadConfigFromEnv() Config {
	cfg := Config{
		DSN:          os.Getenv("DATABASE_URL"),
		MaxIdleConns: 5,
		MaxOpenConns: 20,
		MaxIdleTime:  5 * time.Minute,
		MaxLifeTime:  30 * time.Minute,
	}

	if v := os.Getenv("DB_MAX_IDLE_CONNS"); v != "" {
		fmt.Sscanf(v, "%d", &cfg.MaxIdleConns)
	}
	if v := os.Getenv("DB_MAX_OPEN_CONNS"); v != "" {
		fmt.Sscanf(v, "%d", &cfg.MaxOpenConns)
	}
	if v := os.Getenv("DB_MAX_IDLE_TIME"); v != "" {
		if dur, err := time.ParseDuration(v); err == nil {
			cfg.MaxIdleTime = dur
		}
	}
	if v := os.Getenv("DB_MAX_LIFETIME"); v != "" {
		if dur, err := time.ParseDuration(v); err == nil {
			cfg.MaxLifeTime = dur
		}
	}
	return cfg
}

func Open(cfg Config) (*gorm.DB, error) {
	if cfg.DSN == "" {
		return nil, fmt.Errorf("database DSN is empty")
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
		NamingStrategy: schema.NamingStrategy{
			SingularTable: false,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql db: %w", err)
	}

	if cfg.MaxIdleConns > 0 {
		sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	}
	if cfg.MaxOpenConns > 0 {
		sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	}
	if cfg.MaxIdleTime > 0 {
		sqlDB.SetConnMaxIdleTime(cfg.MaxIdleTime)
	}
	if cfg.MaxLifeTime > 0 {
		sqlDB.SetConnMaxLifetime(cfg.MaxLifeTime)
	}

	return db, nil
}
