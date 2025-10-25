package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"devara-creative-backend/app/auth"
	"devara-creative-backend/app/database"
	"devara-creative-backend/app/repository"
	"devara-creative-backend/app/server"
	"devara-creative-backend/app/storage"

	"github.com/go-co-op/gocron/v2"
	"github.com/joho/godotenv"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using default/system environment variables")
	}

	var (
		addr      = flag.String("addr", ":8000", "HTTP listen address")
		dataFile  = flag.String("data", filepath.Join("storage", "data.json"), "path to data file")
		uploadDir = flag.String("uploads", filepath.Join("storage", "uploads"), "upload directory")
		adminUser = flag.String("admin-email", getenv("ADMIN_EMAIL", "admin@devara-creative.local"), "admin email")
		adminPass = flag.String("admin-password", getenv("ADMIN_PASSWORD", "admin123"), "admin password")
	)
	flag.Parse()

	if err := os.MkdirAll(filepath.Dir(*dataFile), 0o755); err != nil {
		log.Fatalf("failed creating storage directory: %v", err)
	}
	store, err := storage.Load(*dataFile)
	if err != nil {
		log.Fatalf("failed loading store: %v", err)
	}
	store.EnsureAdmin(*adminUser, auth.HashPassword(*adminPass))

	var (
		userRepo    repository.UserRepository
		sessionRepo repository.SessionRepository
	)
	if cfg := database.LoadConfigFromEnv(); cfg.DSN != "" {
		db, err := database.Open(cfg)
		if err != nil {
			log.Printf("database connection failed: %v", err)
		} else {
			if err := database.AutoMigrate(db); err != nil {
				log.Printf("database migration failed: %v", err)
			} else {
				log.Println("database connection established")
				userRepo = repository.NewUserRepository(db)
				sessionRepo = repository.NewSessionRepository(db)
			}
		}
	} else {
		log.Println("DATABASE_URL not set, skipping database initialization")
	}

	scheduler, err := gocron.NewScheduler()
	if err != nil {
		log.Fatalf("failed to create scheduler: %v", err)
	}

	_, err = scheduler.NewJob(
		gocron.DurationJob(5*time.Minute),
		gocron.NewTask(func() {
			now := time.Now().UTC()
			log.Println("Running scheduled job: UpdateExpiredOrders")
			updated, err := store.UpdateExpiredOrders(now)
			if err != nil {
				log.Printf("Error running UpdateExpiredOrders job: %v", err)
				return
			}
			if len(updated) > 0 {
				log.Printf("UpdateExpiredOrders job completed, updated %d orders", len(updated))
			} else {
				log.Println("UpdateExpiredOrders job completed, no orders updated")
			}
		}),
	)
	if err != nil {
		log.Fatalf("failed to schedule job: %v", err)
	}
	scheduler.Start()
	log.Println("Cron job for expired orders scheduled every 5 minutes")

	srv := server.New(store, userRepo, sessionRepo, *uploadDir)
	handler := srv.Handler()

	srvHTTP := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Devara Creative backend running on %s", *addr)
	if err := srvHTTP.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

func getenv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
