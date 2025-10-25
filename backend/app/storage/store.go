package storage

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"devara-creative-backend/app/models"
)

type Store struct {
	mu     sync.RWMutex
	path   string
	data   *snapshot
	loaded bool
}

var (
	ErrPromoInactive      = errors.New("promo code inactive")
	ErrPromoNotStarted    = errors.New("promo code not yet valid")
	ErrPromoExpired       = errors.New("promo code expired")
	ErrPromoUsageExceeded = errors.New("promo code usage limit reached")
	ErrPromoNotFound      = errors.New("promo code not found")
	ErrPromoDuplicate     = errors.New("promo code already exists")
)

func cloneService(src *models.Service) models.Service {
	clone := *src
	if len(src.GalleryImages) > 0 {
		clone.GalleryImages = append([]string(nil), src.GalleryImages...)
	} else {
		clone.GalleryImages = nil
	}
	if len(src.AddOns) > 0 {
		clone.AddOns = append([]models.AddOn(nil), src.AddOns...)
	} else {
		clone.AddOns = nil
	}
	if len(src.Highlights) > 0 {
		clone.Highlights = append([]models.ServiceHighlight(nil), src.Highlights...)
	} else {
		clone.Highlights = nil
	}
	return clone
}

func cloneGalleryItem(src *models.GalleryItem) models.GalleryItem {
	clone := *src
	if len(src.Filters) > 0 {
		clone.Filters = append([]string(nil), src.Filters...)
	} else {
		clone.Filters = nil
	}
	if len(src.Assets) > 0 {
		clone.Assets = append([]models.GalleryAsset(nil), src.Assets...)
	} else {
		clone.Assets = nil
	}
	return clone
}

func cloneExperience(src *models.Experience) models.Experience {
	clone := *src
	return clone
}

func cloneActivity(src *models.Activity) models.Activity {
	clone := *src
	if len(src.Metadata) > 0 {
		meta := make(map[string]string, len(src.Metadata))
		for k, v := range src.Metadata {
			meta[k] = v
		}
		clone.Metadata = meta
	} else if clone.Metadata != nil {
		clone.Metadata = nil
	}
	return clone
}

func cloneAnalyticsEvent(src *models.AnalyticsEvent) models.AnalyticsEvent {
	clone := *src
	if len(src.Metadata) > 0 {
		meta := make(map[string]string, len(src.Metadata))
		for k, v := range src.Metadata {
			meta[k] = v
		}
		clone.Metadata = meta
	} else if clone.Metadata != nil {
		clone.Metadata = nil
	}
	return clone
}

func cloneAnalyticsSession(src *models.AnalyticsSession) models.AnalyticsSession {
	clone := *src
	if len(src.PageSequence) > 0 {
		clone.PageSequence = append([]string(nil), src.PageSequence...)
	} else if clone.PageSequence != nil {
		clone.PageSequence = nil
	}
	return clone
}

func clonePromoCode(src *models.PromoCode) models.PromoCode {
	clone := *src
	return clone
}

type PromoCodeUpdate struct {
	Code            *string
	DiscountPercent *float64
	MaxUsage        *int
	ValidFrom       *time.Time
	ValidUntil      *time.Time
	Active          *bool
	UsedCount       *int
}

type PaymentTransactionUpdate struct {
	Status               string
	Method               string
	Channel              string
	Reference            string
	ExternalID           string
	InvoiceURL           string
	CheckoutURL          string
	QRCodeURL            string
	QRString             string
	VirtualAccountNumber string
	BankCode             string
	PaymentCode          string
	Amount               *float64
	Currency             string
	ExpiresAt            *time.Time
	RawResponse          json.RawMessage
}

type snapshot struct {
	NextIDs                map[string]uint                `json:"next_ids"`
	Admins                 []*models.Admin                `json:"admins"`
	Users                  []*models.User                 `json:"users"`
	Services               []*models.Service              `json:"services"`
	GalleryItems           []*models.GalleryItem          `json:"gallery_items"`
	Experiences            []*models.Experience           `json:"experiences"`
	Categories             []*models.Category             `json:"categories"`
	Orders                 []*models.Order                `json:"orders"`
	Messages               []*models.Message              `json:"messages"`
	Activities             []*models.Activity             `json:"activities"`
	AnalyticsEvents        []*models.AnalyticsEvent       `json:"analytics_events"`
	AnalyticsSessions      []*models.AnalyticsSession     `json:"analytics_sessions"`
	PromoCodes             []*models.PromoCode            `json:"promo_codes"`
	PaymentTransactions    []*models.PaymentTransaction   `json:"payment_transactions"`
	PaymentChannelStatuses []*models.PaymentChannelStatus `json:"payment_channel_statuses,omitempty"`
}

func defaultSnapshot() *snapshot {
	return &snapshot{
		NextIDs: map[string]uint{
			"admin":               1,
			"user":                1,
			"service":             1,
			"gallery_item":        1,
			"experience":          1,
			"category":            1,
			"order":               1,
			"message":             1,
			"activity":            1,
			"analytics_event":     1,
			"analytics_session":   1,
			"promo_code":          1,
			"payment_transaction": 1,
		},
		GalleryItems:           []*models.GalleryItem{},
		Experiences:            []*models.Experience{},
		PaymentTransactions:    []*models.PaymentTransaction{},
		PaymentChannelStatuses: []*models.PaymentChannelStatus{},
	}
}

type AnalyticsEventFilter struct {
	Start     time.Time
	End       time.Time
	Limit     int
	EventType string
	VisitorID string
	SessionID string
}

type AnalyticsSummaryOptions struct {
	Start       time.Time
	End         time.Time
	Resolution  string
	RecentLimit int
}

type AnalyticsTimeseriesPoint struct {
	Bucket       string `json:"bucket"`
	Visitors     int    `json:"visitors"`
	Sessions     int    `json:"sessions"`
	PageViews    int    `json:"page_views"`
	Interactions int    `json:"interactions"`
}

type AnalyticsSourceStat struct {
	Source   string `json:"source"`
	Medium   string `json:"medium,omitempty"`
	Campaign string `json:"campaign,omitempty"`
	Count    int    `json:"count"`
}

type AnalyticsPageStat struct {
	PagePath string `json:"page_path"`
	Views    int    `json:"views"`
	Uniques  int    `json:"unique_visitors"`
}

type AnalyticsFlowStat struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Count int    `json:"count"`
}

type AnalyticsInteractionStat struct {
	EventName string `json:"event_name"`
	EventType string `json:"event_type"`
	Count     int    `json:"count"`
}

type AnalyticsSummary struct {
	RangeStart             time.Time                  `json:"range_start"`
	RangeEnd               time.Time                  `json:"range_end"`
	TotalVisitors          int                        `json:"total_visitors"`
	UniqueVisitors         int                        `json:"unique_visitors"`
	TotalSessions          int                        `json:"total_sessions"`
	TotalPageViews         int                        `json:"total_page_views"`
	TotalEvents            int                        `json:"total_events"`
	AverageSessionDuration float64                    `json:"average_session_duration"`
	Timeseries             []AnalyticsTimeseriesPoint `json:"timeseries"`
	SourceBreakdown        []AnalyticsSourceStat      `json:"source_breakdown"`
	TopPages               []AnalyticsPageStat        `json:"top_pages"`
	PageFlows              []AnalyticsFlowStat        `json:"page_flows"`
	InteractionBreakdown   []AnalyticsInteractionStat `json:"interaction_breakdown"`
	RecentEvents           []models.AnalyticsEvent    `json:"recent_events"`
}

const maxPageSequenceLength = 50
const (
	analyticsRetentionDays     = 90
	maxStoredAnalyticsEvents   = 50000
	maxStoredAnalyticsSessions = 10000
)

func Load(path string) (*Store, error) {
	s := &Store{path: path}
	if err := s.loadFromDisk(); err != nil {
		return nil, err
	}
	if err := s.ensureSampleData(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) loadFromDisk() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := os.Stat(s.path); errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
			return err
		}
		s.data = defaultSnapshot()
		s.loaded = true
		return s.persistLocked()
	}
	f, err := os.Open(s.path)
	if err != nil {
		return err
	}
	defer f.Close()
	dec := json.NewDecoder(f)
	snap := defaultSnapshot()
	if err := dec.Decode(snap); err != nil {
		return err
	}
	if snap.Users == nil {
		snap.Users = []*models.User{}
	}
	if _, ok := snap.NextIDs["user"]; !ok {
		snap.NextIDs["user"] = 1
	}
	if snap.GalleryItems == nil {
		snap.GalleryItems = []*models.GalleryItem{}
	}
	if _, ok := snap.NextIDs["gallery_item"]; !ok {
		snap.NextIDs["gallery_item"] = 1
	}
	if snap.PromoCodes == nil {
		snap.PromoCodes = []*models.PromoCode{}
	}
	if _, ok := snap.NextIDs["promo_code"]; !ok {
		snap.NextIDs["promo_code"] = 1
	}
	if snap.PaymentTransactions == nil {
		snap.PaymentTransactions = []*models.PaymentTransaction{}
	}
	if _, ok := snap.NextIDs["payment_transaction"]; !ok {
		snap.NextIDs["payment_transaction"] = 1
	}
	s.data = snap
	s.loaded = true
	s.pruneAnalyticsLocked(time.Now().UTC())
	return nil
}

func (s *Store) persistLocked() error {
	tmpPath := s.path + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(s.data); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}
	return os.Rename(tmpPath, s.path)
}

func (s *Store) nextID(kind string) uint {
	id, ok := s.data.NextIDs[kind]
	if !ok || id == 0 {
		id = 1
	}
	s.data.NextIDs[kind] = id + 1
	return id
}

func (s *Store) appendActivityLocked(activity *models.Activity) {
	if activity == nil {
		return
	}
	if activity.ID == 0 {
		activity.ID = s.nextID("activity")
	}
	if activity.CreatedAt.IsZero() {
		activity.CreatedAt = time.Now().UTC()
	}
	clone := cloneActivity(activity)
	s.data.Activities = append(s.data.Activities, &clone)
	const maxActivities = 200
	if len(s.data.Activities) > maxActivities {
		s.data.Activities = s.data.Activities[len(s.data.Activities)-maxActivities:]
	}
}

func (s *Store) serviceTitleLocked(id uint) string {
	for _, svc := range s.data.Services {
		if svc.ID == id {
			return svc.Title
		}
	}
	return ""
}

func (s *Store) categoryNameLocked(id uint) string {
	for _, cat := range s.data.Categories {
		if cat.ID == id {
			return cat.Name
		}
	}
	return ""
}

func formatStatus(status string) string {
	status = strings.TrimSpace(strings.ReplaceAll(status, "_", " "))
	if status == "" {
		return ""
	}
	parts := strings.Fields(status)
	for i, part := range parts {
		if len(part) == 0 {
			continue
		}
		lower := strings.ToLower(part)
		parts[i] = strings.ToUpper(lower[:1]) + lower[1:]
	}
	return strings.Join(parts, " ")
}

func (s *Store) ensureLoaded() {
	if !s.loaded {
		panic("store not loaded")
	}
}

func (s *Store) EnsureAdmin(email, passwordHash string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, a := range s.data.Admins {
		if strings.EqualFold(a.Email, email) {
			return
		}
	}
	admin := &models.Admin{ID: s.nextID("admin"), Email: strings.ToLower(email), PasswordHash: passwordHash}
	s.data.Admins = append(s.data.Admins, admin)
	_ = s.persistLocked()
}

func (s *Store) FindAdminByEmail(email string) (*models.Admin, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	lower := strings.ToLower(email)
	for _, a := range s.data.Admins {
		if a.Email == lower {
			clone := *a
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) FindUserByEmail(email string) (*models.User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	lower := strings.ToLower(email)
	for _, u := range s.data.Users {
		if u.Email == lower {
			clone := *u
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) CreateLocalUser(email, name, passwordHash string) (*models.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	lower := strings.ToLower(strings.TrimSpace(email))
	if lower == "" {
		return nil, errors.New("email is required")
	}
	if strings.TrimSpace(passwordHash) == "" {
		return nil, errors.New("password hash is required")
	}

	for _, u := range s.data.Users {
		if u.Email == lower {
			return nil, os.ErrExist
		}
	}

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		if at := strings.Index(lower, "@"); at > 0 {
			cleanName = lower[:at]
		} else {
			cleanName = lower
		}
	}
	now := time.Now().UTC()
	id := s.nextID("user")
	user := &models.User{
		ID:           id,
		Email:        lower,
		Name:         cleanName,
		Provider:     "local",
		ProviderID:   fmt.Sprintf("local-%d", id),
		PasswordHash: passwordHash,
		CreatedAt:    now,
		UpdatedAt:    now,
		LastLogin:    now,
	}
	s.data.Users = append(s.data.Users, user)
	clone := *user
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return &clone, nil
}

func (s *Store) RecordUserLogin(id uint, loginAt time.Time) (*models.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	now := loginAt.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}
	for _, u := range s.data.Users {
		if u.ID == id {
			u.LastLogin = now
			u.UpdatedAt = now
			clone := *u
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) UpsertOAuthUser(email, name, picture, provider, providerID string, loginAt time.Time) (*models.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	lower := strings.ToLower(strings.TrimSpace(email))
	if lower == "" {
		return nil, errors.New("email is required")
	}
	name = strings.TrimSpace(name)
	picture = strings.TrimSpace(picture)
	provider = strings.TrimSpace(provider)
	providerID = strings.TrimSpace(providerID)
	now := loginAt.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}

	for _, u := range s.data.Users {
		if u.Email == lower {
			u.Name = name
			u.Picture = picture
			u.Provider = provider
			u.ProviderID = providerID
			u.LastLogin = now
			u.UpdatedAt = now
			clone := *u
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			return &clone, nil
		}
	}

	user := &models.User{
		ID:         s.nextID("user"),
		Email:      lower,
		Name:       name,
		Picture:    picture,
		Provider:   provider,
		ProviderID: providerID,
		CreatedAt:  now,
		UpdatedAt:  now,
		LastLogin:  now,
	}
	s.data.Users = append(s.data.Users, user)
	clone := *user
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return &clone, nil
}

func (s *Store) ListCategories() []models.Category {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	out := make([]models.Category, 0, len(s.data.Categories))
	for _, c := range s.data.Categories {
		out = append(out, *c)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out
}

func (s *Store) CreateCategory(cat *models.Category) (*models.Category, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	cat.ID = s.nextID("category")
	if cat.Slug != "" {
		cat.Slug = slugify(cat.Slug)
	} else {
		cat.Slug = slugify(cat.Name)
	}
	clone := *cat
	s.data.Categories = append(s.data.Categories, &clone)
	s.appendActivityLocked(&models.Activity{
		Type:        "category",
		Action:      "created",
		Title:       fmt.Sprintf("Kategori \"%s\" ditambahkan", cat.Name),
		Description: fmt.Sprintf("Slug: %s", cat.Slug),
		ReferenceID: cat.ID,
		Metadata: map[string]string{
			"name": cat.Name,
			"slug": cat.Slug,
		},
	})
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *Store) UpdateCategory(id uint, name, slug string) (*models.Category, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, c := range s.data.Categories {
		if c.ID == id {
			prevName := c.Name
			prevSlug := c.Slug
			c.Name = name
			if slug != "" {
				c.Slug = slugify(slug)
			} else {
				c.Slug = slugify(name)
			}
			s.appendActivityLocked(&models.Activity{
				Type:        "category",
				Action:      "updated",
				Title:       fmt.Sprintf("Kategori \"%s\" diperbarui", c.Name),
				Description: fmt.Sprintf("Sebelumnya \"%s\" (%s)", prevName, prevSlug),
				ReferenceID: c.ID,
				Metadata: map[string]string{
					"old_name": prevName,
					"old_slug": prevSlug,
					"name":     c.Name,
					"slug":     c.Slug,
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := *c
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) DeleteCategory(id uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	filtered := s.data.Categories[:0]
	var deletedName, deletedSlug string
	for _, c := range s.data.Categories {
		if c.ID != id {
			filtered = append(filtered, c)
		} else {
			deletedName = c.Name
			deletedSlug = c.Slug
		}
	}
	s.data.Categories = filtered
	for _, svc := range s.data.Services {
		if svc.CategoryID == id {
			svc.CategoryID = 0
		}
	}
	if deletedName != "" {
		s.appendActivityLocked(&models.Activity{
			Type:        "category",
			Action:      "deleted",
			Title:       fmt.Sprintf("Kategori \"%s\" dihapus", deletedName),
			Description: fmt.Sprintf("Slug: %s", deletedSlug),
			ReferenceID: id,
			Metadata: map[string]string{
				"name": deletedName,
				"slug": deletedSlug,
			},
		})
	}
	return s.persistLocked()
}

func (s *Store) GetCategoryByID(id uint) (*models.Category, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	for _, c := range s.data.Categories {
		if c.ID == id {
			clone := *c
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) GetCategoryBySlug(slug string) (*models.Category, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	lower := strings.ToLower(slug)
	for _, c := range s.data.Categories {
		if c.Slug == lower {
			clone := *c
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) ListServices() []models.Service {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	out := make([]models.Service, 0, len(s.data.Services))
	for _, svc := range s.data.Services {
		out = append(out, cloneService(svc))
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Title) < strings.ToLower(out[j].Title) })
	return out
}

func (s *Store) GetServiceBySlug(slug string) (*models.Service, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	lower := strings.ToLower(slug)
	for _, svc := range s.data.Services {
		if svc.Slug == lower {
			clone := cloneService(svc)
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) GetServiceByID(id uint) (*models.Service, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	for _, svc := range s.data.Services {
		if svc.ID == id {
			clone := cloneService(svc)
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) CreateService(svc *models.Service) (*models.Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	svc.ID = s.nextID("service")
	svc.Slug = slugify(svc.Slug)
	if svc.Slug == "" {
		svc.Slug = slugify(svc.Title)
	}
	clone := cloneService(svc)
	s.data.Services = append(s.data.Services, &clone)
	categoryName := s.categoryNameLocked(svc.CategoryID)
	description := "Belum ada kategori"
	if categoryName != "" {
		description = fmt.Sprintf("Kategori: %s", categoryName)
	}
	s.appendActivityLocked(&models.Activity{
		Type:        "service",
		Action:      "created",
		Title:       fmt.Sprintf("Layanan \"%s\" ditambahkan", svc.Title),
		Description: description,
		ReferenceID: svc.ID,
		Metadata: map[string]string{
			"title":          svc.Title,
			"slug":           svc.Slug,
			"category_name":  categoryName,
			"category_id":    fmt.Sprintf("%d", svc.CategoryID),
			"price":          fmt.Sprintf("%.2f", svc.Price),
			"highlight_type": "created",
		},
	})
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return svc, nil
}

func (s *Store) UpdateService(id uint, update *models.Service) (*models.Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, svc := range s.data.Services {
		if svc.ID == id {
			prev := cloneService(svc)
			svc.Title = update.Title
			svc.Price = update.Price
			svc.CategoryID = update.CategoryID
			svc.Summary = update.Summary
			svc.Description = update.Description
			if update.AddOns != nil {
				svc.AddOns = append([]models.AddOn(nil), update.AddOns...)
			}
			if update.Highlights != nil {
				svc.Highlights = append([]models.ServiceHighlight(nil), update.Highlights...)
			}
			if update.Thumbnail != "" {
				svc.Thumbnail = update.Thumbnail
			}
			if update.GalleryImages != nil {
				svc.GalleryImages = append([]string(nil), update.GalleryImages...)
			}
			if update.Slug != "" {
				svc.Slug = slugify(update.Slug)
			}
			if svc.Slug == "" {
				svc.Slug = slugify(update.Title)
			}
			categoryName := s.categoryNameLocked(svc.CategoryID)
			prevCategoryName := s.categoryNameLocked(prev.CategoryID)
			s.appendActivityLocked(&models.Activity{
				Type:        "service",
				Action:      "updated",
				Title:       fmt.Sprintf("Layanan \"%s\" diperbarui", svc.Title),
				Description: fmt.Sprintf("Kategori: %s", categoryName),
				ReferenceID: svc.ID,
				Metadata: map[string]string{
					"title":             svc.Title,
					"slug":              svc.Slug,
					"category_name":     categoryName,
					"category_id":       fmt.Sprintf("%d", svc.CategoryID),
					"price":             fmt.Sprintf("%.2f", svc.Price),
					"old_title":         prev.Title,
					"old_slug":          prev.Slug,
					"old_category_name": prevCategoryName,
					"old_category_id":   fmt.Sprintf("%d", prev.CategoryID),
					"old_price":         fmt.Sprintf("%.2f", prev.Price),
					"highlight_type":    "updated",
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := cloneService(svc)
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) DeleteService(id uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	filtered := s.data.Services[:0]
	var deleted *models.Service
	for _, svc := range s.data.Services {
		if svc.ID != id {
			filtered = append(filtered, svc)
		} else {
			clone := cloneService(svc)
			deleted = &clone
		}
	}
	s.data.Services = filtered
	if deleted != nil {
		categoryName := s.categoryNameLocked(deleted.CategoryID)
		s.appendActivityLocked(&models.Activity{
			Type:        "service",
			Action:      "deleted",
			Title:       fmt.Sprintf("Layanan \"%s\" dihapus", deleted.Title),
			Description: fmt.Sprintf("Kategori: %s", categoryName),
			ReferenceID: deleted.ID,
			Metadata: map[string]string{
				"title":          deleted.Title,
				"slug":           deleted.Slug,
				"category_name":  categoryName,
				"category_id":    fmt.Sprintf("%d", deleted.CategoryID),
				"highlight_type": "deleted",
			},
		})
	}
	return s.persistLocked()
}

func (s *Store) maxExperienceOrderLocked() int {
	max := 0
	for _, exp := range s.data.Experiences {
		if exp.Order > max {
			max = exp.Order
		}
	}
	return max
}

func (s *Store) ListExperiences() []models.Experience {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	out := make([]models.Experience, 0, len(s.data.Experiences))
	for _, exp := range s.data.Experiences {
		out = append(out, cloneExperience(exp))
	}
	if len(out) > 1 {
		sort.SliceStable(out, func(i, j int) bool {
			oi, oj := out[i].Order, out[j].Order
			switch {
			case oi == oj:
				if out[i].CreatedAt.Equal(out[j].CreatedAt) {
					return out[i].ID < out[j].ID
				}
				return out[i].CreatedAt.Before(out[j].CreatedAt)
			case oi == 0:
				return false
			case oj == 0:
				return true
			default:
				return oi < oj
			}
		})
	}
	return out
}

func (s *Store) GetExperienceByID(id uint) (*models.Experience, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	for _, exp := range s.data.Experiences {
		if exp.ID == id {
			clone := cloneExperience(exp)
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) CreateExperience(exp *models.Experience) (*models.Experience, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	now := time.Now().UTC()
	exp.ID = s.nextID("experience")
	exp.Period = strings.TrimSpace(exp.Period)
	exp.Title = strings.TrimSpace(exp.Title)
	exp.Company = strings.TrimSpace(exp.Company)
	exp.Description = strings.TrimSpace(exp.Description)
	if exp.Order <= 0 {
		exp.Order = s.maxExperienceOrderLocked() + 1
	}
	exp.CreatedAt = now
	exp.UpdatedAt = now
	clone := cloneExperience(exp)
	s.data.Experiences = append(s.data.Experiences, &clone)
	s.appendActivityLocked(&models.Activity{
		Type:        "experience",
		Action:      "created",
		Title:       fmt.Sprintf("Pengalaman \"%s\" ditambahkan", exp.Title),
		Description: exp.Period,
		ReferenceID: exp.ID,
		Metadata: map[string]string{
			"title":   exp.Title,
			"period":  exp.Period,
			"company": exp.Company,
		},
	})
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return exp, nil
}

func (s *Store) UpdateExperience(id uint, update *models.Experience) (*models.Experience, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, exp := range s.data.Experiences {
		if exp.ID == id {
			prev := cloneExperience(exp)
			exp.Period = strings.TrimSpace(update.Period)
			exp.Title = strings.TrimSpace(update.Title)
			exp.Company = strings.TrimSpace(update.Company)
			exp.Description = strings.TrimSpace(update.Description)
			if update.Order > 0 {
				exp.Order = update.Order
			}
			exp.UpdatedAt = time.Now().UTC()
			s.appendActivityLocked(&models.Activity{
				Type:        "experience",
				Action:      "updated",
				Title:       fmt.Sprintf("Pengalaman \"%s\" diperbarui", exp.Title),
				Description: exp.Period,
				ReferenceID: exp.ID,
				Metadata: map[string]string{
					"title":       exp.Title,
					"period":      exp.Period,
					"company":     exp.Company,
					"old_title":   prev.Title,
					"old_period":  prev.Period,
					"old_company": prev.Company,
					"order":       fmt.Sprintf("%d", exp.Order),
					"old_order":   fmt.Sprintf("%d", prev.Order),
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := cloneExperience(exp)
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) DeleteExperience(id uint) (*models.Experience, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	filtered := s.data.Experiences[:0]
	var deleted *models.Experience
	for _, exp := range s.data.Experiences {
		if exp.ID != id {
			filtered = append(filtered, exp)
			continue
		}
		clone := cloneExperience(exp)
		deleted = &clone
	}
	s.data.Experiences = filtered
	if deleted != nil {
		s.appendActivityLocked(&models.Activity{
			Type:        "experience",
			Action:      "deleted",
			Title:       fmt.Sprintf("Pengalaman \"%s\" dihapus", deleted.Title),
			Description: deleted.Period,
			ReferenceID: deleted.ID,
			Metadata: map[string]string{
				"title":   deleted.Title,
				"period":  deleted.Period,
				"company": deleted.Company,
			},
		})
		if err := s.persistLocked(); err != nil {
			return nil, err
		}
		return deleted, nil
	}
	return nil, os.ErrNotExist
}

func (s *Store) ListOrders() []models.Order {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	out := make([]models.Order, 0, len(s.data.Orders))
	for _, o := range s.data.Orders {
		out = append(out, *o)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func clonePaymentTransaction(src *models.PaymentTransaction) *models.PaymentTransaction {
	if src == nil {
		return nil
	}
	clone := *src
	if len(src.RawResponse) > 0 {
		clone.RawResponse = append(json.RawMessage(nil), src.RawResponse...)
	}
	return &clone
}

func clonePaymentChannelStatus(src *models.PaymentChannelStatus) models.PaymentChannelStatus {
	if src == nil {
		return models.PaymentChannelStatus{}
	}
	clone := *src
	return clone
}

func (s *Store) SetPaymentChannelStatus(category, channel string, available bool, message string) (*models.PaymentChannelStatus, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	normalizedCategory := strings.ToUpper(strings.TrimSpace(category))
	normalizedChannel := strings.ToUpper(strings.TrimSpace(channel))
	if normalizedCategory == "" {
		return nil, false, errors.New("category is required")
	}
	if normalizedChannel == "" {
		normalizedChannel = normalizedCategory
	}
	trimmedMessage := strings.TrimSpace(message)
	if s.data.PaymentChannelStatuses == nil {
		s.data.PaymentChannelStatuses = []*models.PaymentChannelStatus{}
	}

	var existing *models.PaymentChannelStatus
	for _, status := range s.data.PaymentChannelStatuses {
		if status == nil {
			continue
		}
		if strings.EqualFold(status.Category, normalizedCategory) && strings.EqualFold(status.Channel, normalizedChannel) {
			existing = status
			break
		}
	}

	if existing == nil {
		existing = &models.PaymentChannelStatus{
			Category: normalizedCategory,
			Channel:  normalizedChannel,
		}
		s.data.PaymentChannelStatuses = append(s.data.PaymentChannelStatuses, existing)
	}

	changed := existing.Available != available || strings.TrimSpace(existing.Message) != trimmedMessage
	if !strings.EqualFold(existing.Category, normalizedCategory) || !strings.EqualFold(existing.Channel, normalizedChannel) {
		changed = true
	}

	existing.Category = normalizedCategory
	existing.Channel = normalizedChannel
	existing.Available = available
	existing.Message = trimmedMessage
	existing.UpdatedAt = time.Now().UTC()

	if err := s.persistLocked(); err != nil {
		return nil, false, err
	}

	clone := clonePaymentChannelStatus(existing)
	return &clone, changed, nil
}

func (s *Store) ListPaymentChannelStatuses() []models.PaymentChannelStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()

	if len(s.data.PaymentChannelStatuses) == 0 {
		return []models.PaymentChannelStatus{}
	}

	out := make([]models.PaymentChannelStatus, 0, len(s.data.PaymentChannelStatuses))
	for _, status := range s.data.PaymentChannelStatuses {
		if status == nil {
			continue
		}
		clone := clonePaymentChannelStatus(status)
		out = append(out, clone)
	}
	sort.Slice(out, func(i, j int) bool {
		if strings.EqualFold(out[i].Category, out[j].Category) {
			return strings.ToUpper(out[i].Channel) < strings.ToUpper(out[j].Channel)
		}
		return strings.ToUpper(out[i].Category) < strings.ToUpper(out[j].Category)
	})
	return out
}

func isPaymentCompletedStatus(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "PAID", "COMPLETED", "SETTLED", "SUCCESS":
		return true
	default:
		return false
	}
}

func IsCancelledStatus(status string) bool {
	if status == "" {
		return false
	}
	upper := strings.ToUpper(strings.TrimSpace(status))
	if upper == "CANCELLED" || upper == "CANCELED" {
		return true
	}
	return strings.Contains(upper, "CANCEL")
}

func IsPaymentFailureStatus(status string) bool {
	if status == "" {
		return false
	}
	upper := strings.ToUpper(strings.TrimSpace(status))
	switch upper {
	case "EXPIRED", "CANCELLED", "CANCELED", "FAILED", "VOID", "VOIDED", "DENIED", "REJECTED", "TIMEOUT", "CHARGEBACK", "CHARGED_BACK":
		return true
	}
	if strings.Contains(upper, "CANCEL") {
		return true
	}
	if strings.Contains(upper, "EXPIRE") {
		return true
	}
	if strings.Contains(upper, "FAIL") {
		return true
	}
	if strings.Contains(upper, "REJECT") {
		return true
	}
	if strings.Contains(upper, "DENIED") {
		return true
	}
	if strings.Contains(upper, "VOID") {
		return true
	}
	if strings.Contains(upper, "TIMEOUT") {
		return true
	}
	if strings.Contains(upper, "REFUND") {
		return true
	}
	return false
}

func PaymentCancelReason(status string) string {
	upper := strings.ToUpper(strings.TrimSpace(status))
	switch {
	case upper == "":
		return ""
	case strings.Contains(upper, "EXPIRE"):
		return "Cancelled by system (Payment expired)"
	case strings.Contains(upper, "CANCEL"):
		return "Cancelled by system (Payment cancelled)"
	case strings.Contains(upper, "FAIL"):
		return "Cancelled by system (Payment failed)"
	case strings.Contains(upper, "REJECT") || strings.Contains(upper, "DENIED"):
		return "Cancelled by system (Payment rejected)"
	case strings.Contains(upper, "VOID"):
		return "Cancelled by system (Payment voided)"
	case strings.Contains(upper, "REFUND"):
		return "Cancelled by system (Payment refunded)"
	case strings.Contains(upper, "TIMEOUT"):
		return "Cancelled by system (Payment timeout)"
	case strings.Contains(upper, "CHARGEBACK") || strings.Contains(upper, "CHARGED_BACK"):
		return "Cancelled by system (Payment chargeback)"
	default:
		label := formatStatus(upper)
		if label == "" {
			label = "Payment invalid"
		}
		return fmt.Sprintf("Cancelled by system (%s)", label)
	}
}

func (s *Store) applyOrderPaymentOutcomeLocked(order *models.Order, prevStatus string, serviceTitle string, updateCategory string, now time.Time) bool {
	if order == nil {
		return false
	}
	paymentStatus := strings.ToUpper(strings.TrimSpace(order.PaymentStatus))
	if paymentStatus == "" {
		if order.CancelReason != "" && !IsCancelledStatus(order.Status) {
			order.CancelReason = ""
			order.UpdatedAt = now
			return true
		}
		return false
	}
	if isPaymentCompletedStatus(paymentStatus) {
		changed := false
		if order.CancelReason != "" {
			order.CancelReason = ""
			changed = true
		}
		if !strings.EqualFold(order.Status, "PAID") {
			previous := prevStatus
			prevStatusLabel := formatStatus(previous)
			order.Status = "PAID"
			statusLabel := formatStatus(order.Status)
			desc := fmt.Sprintf("Pembayaran selesai • %s", statusLabel)
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "status_changed",
				Title:       fmt.Sprintf("Status order #%d", order.ID),
				Description: desc,
				ReferenceID: order.ID,
				Metadata: map[string]string{
					"status":          order.Status,
					"status_label":    statusLabel,
					"previous_status": previous,
					"previous_label":  prevStatusLabel,
					"service_title":   serviceTitle,
					"service_id":      fmt.Sprintf("%d", order.ServiceID),
					"highlight_type":  "order_status",
					"update_category": updateCategory,
				},
			})
			changed = true
		}
		if changed {
			order.UpdatedAt = now
		}
		return changed
	}
	if IsPaymentFailureStatus(paymentStatus) {
		reason := PaymentCancelReason(paymentStatus)
		if IsCancelledStatus(order.Status) && order.CancelReason == reason {
			return false
		}
		previous := prevStatus
		prevStatusLabel := formatStatus(previous)
		newStatus := order.Status
		if !IsCancelledStatus(newStatus) || strings.EqualFold(newStatus, "cancelled") {
			newStatus = "cancelled_by_admin"
		}
		order.Status = newStatus
		order.CancelReason = reason
		statusLabel := formatStatus(order.Status)
		desc := fmt.Sprintf("Dari %s ke %s", prevStatusLabel, statusLabel)
		if previous == "" || strings.EqualFold(previous, order.Status) {
			desc = fmt.Sprintf("Status: %s", statusLabel)
		}
		if reason != "" {
			desc = fmt.Sprintf("%s • %s", desc, reason)
		}
		metadata := map[string]string{
			"status":          order.Status,
			"status_label":    statusLabel,
			"previous_status": previous,
			"previous_label":  prevStatusLabel,
			"service_title":   serviceTitle,
			"service_id":      fmt.Sprintf("%d", order.ServiceID),
			"highlight_type":  "order_status",
			"update_category": updateCategory,
		}
		if reason != "" {
			metadata["cancel_reason"] = reason
		}
		s.appendActivityLocked(&models.Activity{
			Type:        "order",
			Action:      "status_changed",
			Title:       fmt.Sprintf("Status order #%d", order.ID),
			Description: desc,
			ReferenceID: order.ID,
			Metadata:    metadata,
		})
		order.UpdatedAt = now
		return true
	}
	if order.CancelReason != "" && !IsCancelledStatus(order.Status) {
		order.CancelReason = ""
		order.UpdatedAt = now
		return true
	}
	return false
}

func normalizeRefundStatus(status string) string {
	trimmed := strings.TrimSpace(status)
	if trimmed == "" {
		return ""
	}
	switch strings.ToUpper(trimmed) {
	case "PENDING", "ONHOLD", "ON_HOLD", "IN_PROGRESS", "PROCESSING", "NEEDS_ACTION":
		return "refund_pending"
	case "FAILED", "FAILURE", "CANCELLED", "CANCELED", "REJECTED":
		return "refund_failed"
	case "SUCCEEDED", "SUCCESS", "COMPLETED", "DONE", "SETTLED":
		return "refunded"
	default:
		return strings.ToLower(trimmed)
	}
}

func (s *Store) GetLatestPaymentTransactionByOrder(orderID uint) (*models.PaymentTransaction, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	var latest *models.PaymentTransaction
	for _, tx := range s.data.PaymentTransactions {
		if tx.OrderID != orderID {
			continue
		}
		if latest == nil || tx.CreatedAt.After(latest.CreatedAt) {
			latest = tx
		}
	}
	if latest == nil {
		return nil, false
	}
	return clonePaymentTransaction(latest), true
}

func (s *Store) latestPaymentTransactionForOrderLocked(orderID uint) *models.PaymentTransaction {
	var latest *models.PaymentTransaction
	for _, tx := range s.data.PaymentTransactions {
		if tx.OrderID != orderID {
			continue
		}
		if latest == nil || tx.CreatedAt.After(latest.CreatedAt) {
			latest = tx
		}
	}
	return latest
}

func (s *Store) SyncOrderPaymentStatuses(now time.Time) ([]models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	updated := make([]models.Order, 0)
	for _, order := range s.data.Orders {
		latest := s.latestPaymentTransactionForOrderLocked(order.ID)
		if latest == nil || strings.EqualFold(latest.Method, "xendit_disbursement") {
			continue
		}
		prevPaymentStatusUpper := strings.ToUpper(strings.TrimSpace(order.PaymentStatus))
		prevStatus := order.Status
		serviceTitle := s.serviceTitleLocked(order.ServiceID)

		changed := false
		statusChanged := false
		methodChanged := false

		if latest.Method != "" && !strings.EqualFold(order.PaymentMethod, latest.Method) {
			order.PaymentMethod = latest.Method
			changed = true
			methodChanged = true
		}
		if latest.Status != "" {
			normalized := strings.ToUpper(strings.TrimSpace(latest.Status))
			if prevPaymentStatusUpper != normalized {
				order.PaymentStatus = normalized
				changed = true
				statusChanged = true
			}
		}
		if latest.Reference != "" && order.PaymentReference != latest.Reference {
			order.PaymentReference = latest.Reference
			changed = true
		}
		if !latest.ExpiresAt.IsZero() && !order.PaymentExpiresAt.Equal(latest.ExpiresAt) {
			order.PaymentExpiresAt = latest.ExpiresAt
			changed = true
		}

		var expiresAt time.Time
		if latest != nil && !latest.ExpiresAt.IsZero() {
			expiresAt = latest.ExpiresAt
		} else if !order.PaymentExpiresAt.IsZero() {
			expiresAt = order.PaymentExpiresAt
		}

		if !expiresAt.IsZero() && now.After(expiresAt) {
			if !IsPaymentFailureStatus(order.PaymentStatus) && !isPaymentCompletedStatus(order.PaymentStatus) {
				if !strings.EqualFold(order.PaymentStatus, "EXPIRED") {
					order.PaymentStatus = "EXPIRED"
					changed = true
					statusChanged = true
				}
			}
		}

		if statusChanged {
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "payment_status_updated",
				Title:       fmt.Sprintf("Status pembayaran order #%d", order.ID),
				Description: fmt.Sprintf("Status pembayaran: %s", order.PaymentStatus),
				ReferenceID: order.ID,
				Metadata: map[string]string{
					"payment_status":    order.PaymentStatus,
					"payment_method":    order.PaymentMethod,
					"payment_reference": order.PaymentReference,
					"service_title":     serviceTitle,
					"service_id":        fmt.Sprintf("%d", order.ServiceID),
					"highlight_type":    "order_payment",
					"update_category":   "payment_sync",
				},
			})
		}
		if methodChanged && order.PaymentMethod != "" {
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "payment_method_updated",
				Title:       fmt.Sprintf("Metode pembayaran order #%d", order.ID),
				Description: fmt.Sprintf("Metode pembayaran: %s", order.PaymentMethod),
				ReferenceID: order.ID,
				Metadata: map[string]string{
					"payment_status":  order.PaymentStatus,
					"payment_method":  order.PaymentMethod,
					"service_title":   serviceTitle,
					"service_id":      fmt.Sprintf("%d", order.ServiceID),
					"highlight_type":  "order_payment",
					"update_category": "payment_sync",
				},
			})
		}

		if s.applyOrderPaymentOutcomeLocked(order, prevStatus, serviceTitle, "payment_sync", now) {
			changed = true
		}

		if changed {
			order.UpdatedAt = now
			clone := *order
			updated = append(updated, clone)
		}
	}

	if len(updated) > 0 {
		if err := s.persistLocked(); err != nil {
			return nil, err
		}
	}

	return updated, nil
}

func (s *Store) UpdateExpiredOrders(now time.Time) ([]models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	updated := make([]models.Order, 0)
	anyChanged := false

	for _, order := range s.data.Orders {
		if order.Status != "pending" || order.PaymentExpiresAt.IsZero() || now.Before(order.PaymentExpiresAt) {
			continue
		}

		if strings.EqualFold(order.PaymentStatus, "EXPIRED") {
			continue
		}

		prevStatus := order.Status
		serviceTitle := s.serviceTitleLocked(order.ServiceID)

		order.PaymentStatus = "EXPIRED"
		order.UpdatedAt = now
		anyChanged = true

		s.appendActivityLocked(&models.Activity{
			Type:        "order",
			Action:      "payment_status_updated",
			Title:       fmt.Sprintf("Status pembayaran order #%d", order.ID),
			Description: "Status pembayaran: EXPIRED (by system job)",
			ReferenceID: order.ID,
			Metadata: map[string]string{
				"payment_status":  order.PaymentStatus,
				"service_title":   serviceTitle,
				"service_id":      fmt.Sprintf("%d", order.ServiceID),
				"highlight_type":  "order_payment",
				"update_category": "system_job_expire",
			},
		})

		if s.applyOrderPaymentOutcomeLocked(order, prevStatus, serviceTitle, "system_job_expire", now) {
			clone := *order
			updated = append(updated, clone)
		}
	}

	if anyChanged {
		if err := s.persistLocked(); err != nil {
			return nil, err
		}
	}

	return updated, nil
}

func (s *Store) CreatePaymentTransaction(tx *models.PaymentTransaction) (*models.PaymentTransaction, *models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	var order *models.Order
	for _, o := range s.data.Orders {
		if o.ID == tx.OrderID {
			order = o
			break
		}
	}
	if order == nil {
		return nil, nil, os.ErrNotExist
	}
	now := time.Now().UTC()
	tx.ID = s.nextID("payment_transaction")
	tx.Status = strings.ToUpper(strings.TrimSpace(tx.Status))
	tx.CreatedAt = now
	tx.UpdatedAt = now
	if tx.Reference == "" {
		tx.Reference = fmt.Sprintf("ORDER-%d", order.ID)
	}
	if tx.Method == "" {
		tx.Method = order.PaymentMethod
	}
	clone := clonePaymentTransaction(tx)
	s.data.PaymentTransactions = append(s.data.PaymentTransactions, clone)

	prevPaymentStatus := order.PaymentStatus
	prevPaymentMethod := order.PaymentMethod
	prevOrderStatus := order.Status
	isDisbursement := strings.EqualFold(tx.Method, "xendit_disbursement")
	serviceTitle := s.serviceTitleLocked(order.ServiceID)

	if isDisbursement {
		if tx.Status != "" {
			order.RefundStatus = normalizeRefundStatus(tx.Status)
		}
		order.UpdatedAt = now
		if order.RefundStatus != "" {
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "refund_status_updated",
				Title:       fmt.Sprintf("Status refund order #%d", order.ID),
				Description: fmt.Sprintf("Status refund: %s", formatStatus(order.RefundStatus)),
				ReferenceID: order.ID,
				Metadata: map[string]string{
					"refund_status":  order.RefundStatus,
					"payment_method": order.PaymentMethod,
					"service_title":  serviceTitle,
					"service_id":     fmt.Sprintf("%d", order.ServiceID),
					"highlight_type": "order_refund",
				},
			})
		}
	} else {
		order.PaymentMethod = tx.Method
		if tx.Status != "" {
			order.PaymentStatus = tx.Status
		}
		order.PaymentReference = tx.Reference
		order.PaymentExpiresAt = tx.ExpiresAt
		order.UpdatedAt = now

		if tx.Status != "" && !strings.EqualFold(prevPaymentStatus, tx.Status) {
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "payment_status_updated",
				Title:       fmt.Sprintf("Status pembayaran order #%d", order.ID),
				Description: fmt.Sprintf("Status pembayaran: %s", strings.ToUpper(tx.Status)),
				ReferenceID: order.ID,
				Metadata: map[string]string{
					"payment_status":    tx.Status,
					"payment_method":    tx.Method,
					"payment_reference": tx.Reference,
					"service_title":     serviceTitle,
					"service_id":        fmt.Sprintf("%d", order.ServiceID),
					"highlight_type":    "order_payment",
				},
			})
		}
		if prevPaymentMethod != order.PaymentMethod && order.PaymentMethod != "" {
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "payment_method_updated",
				Title:       fmt.Sprintf("Metode pembayaran order #%d", order.ID),
				Description: fmt.Sprintf("Metode pembayaran: %s", order.PaymentMethod),
				ReferenceID: order.ID,
				Metadata: map[string]string{
					"payment_status": order.PaymentStatus,
					"payment_method": order.PaymentMethod,
					"service_title":  serviceTitle,
					"service_id":     fmt.Sprintf("%d", order.ServiceID),
					"highlight_type": "order_payment",
				},
			})
		}
		s.applyOrderPaymentOutcomeLocked(order, prevOrderStatus, serviceTitle, "payment", now)
	}

	if err := s.persistLocked(); err != nil {
		return nil, nil, err
	}

	storedTx := clonePaymentTransaction(clone)
	if storedTx == nil {
		storedTx = clonePaymentTransaction(tx)
	}
	outOrder := *order
	return storedTx, &outOrder, nil
}

func (s *Store) ApplyPaymentTransactionUpdate(xenditID, reference, externalID string, update PaymentTransactionUpdate) (*models.PaymentTransaction, *models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	var target *models.PaymentTransaction
	match := func(candidate *models.PaymentTransaction) bool {
		if candidate == nil {
			return false
		}
		switch {
		case xenditID != "" && strings.EqualFold(candidate.XenditID, xenditID):
			return true
		case externalID != "" && strings.EqualFold(candidate.ExternalID, externalID):
			return true
		case reference != "" && strings.EqualFold(candidate.Reference, reference):
			return true
		}
		return false
	}
	for _, tx := range s.data.PaymentTransactions {
		if match(tx) {
			target = tx
			break
		}
	}
	if target == nil {
		return nil, nil, os.ErrNotExist
	}
	var order *models.Order
	for _, o := range s.data.Orders {
		if o.ID == target.OrderID {
			order = o
			break
		}
	}
	now := time.Now().UTC()
	if update.Status != "" {
		target.Status = strings.ToUpper(update.Status)
	}
	if update.Method != "" {
		target.Method = strings.ToLower(strings.TrimSpace(update.Method))
	}
	if update.Channel != "" {
		target.Channel = update.Channel
	}
	if update.Reference != "" {
		target.Reference = update.Reference
	}
	if update.ExternalID != "" {
		target.ExternalID = update.ExternalID
	}
	if update.InvoiceURL != "" {
		target.InvoiceURL = update.InvoiceURL
	}
	if update.CheckoutURL != "" {
		target.CheckoutURL = update.CheckoutURL
	}
	if update.QRCodeURL != "" {
		target.QRCodeURL = update.QRCodeURL
	}
	if update.QRString != "" {
		target.QRString = update.QRString
	}
	if update.VirtualAccountNumber != "" {
		target.VirtualAccountNumber = update.VirtualAccountNumber
	}
	if update.BankCode != "" {
		target.BankCode = update.BankCode
	}
	if update.PaymentCode != "" {
		target.PaymentCode = update.PaymentCode
	}
	if update.Amount != nil {
		target.Amount = *update.Amount
	}
	if update.Currency != "" {
		target.Currency = update.Currency
	}
	if update.ExpiresAt != nil {
		target.ExpiresAt = *update.ExpiresAt
	}
	if len(update.RawResponse) > 0 {
		target.RawResponse = append(json.RawMessage(nil), update.RawResponse...)
	}
	target.UpdatedAt = now

	var outOrder *models.Order
	if order != nil {
		prevPaymentStatus := order.PaymentStatus
		prevPaymentMethod := order.PaymentMethod
		prevRefundStatus := order.RefundStatus
		prevOrderStatus := order.Status
		isDisbursement := strings.EqualFold(target.Method, "xendit_disbursement")

		if target.Method != "" && !isDisbursement {
			order.PaymentMethod = target.Method
		}
		if update.Reference != "" {
			order.PaymentReference = target.Reference
		}
		if update.ExpiresAt != nil && !isDisbursement {
			order.PaymentExpiresAt = target.ExpiresAt
		}
		if target.Status != "" {
			if isDisbursement {
				order.RefundStatus = normalizeRefundStatus(target.Status)
			} else {
				order.PaymentStatus = strings.ToUpper(target.Status)
			}
		}
		order.UpdatedAt = now
		serviceTitle := s.serviceTitleLocked(order.ServiceID)

		if isDisbursement {
			if order.RefundStatus != "" && !strings.EqualFold(prevRefundStatus, order.RefundStatus) {
				currentLabel := formatStatus(order.RefundStatus)
				prevLabel := formatStatus(prevRefundStatus)
				desc := fmt.Sprintf("Status refund: %s", currentLabel)
				if prevRefundStatus != "" {
					desc = fmt.Sprintf("Status refund dari %s ke %s", prevLabel, currentLabel)
				}
				s.appendActivityLocked(&models.Activity{
					Type:        "order",
					Action:      "refund_status_updated",
					Title:       fmt.Sprintf("Status refund order #%d", order.ID),
					Description: desc,
					ReferenceID: order.ID,
					Metadata: map[string]string{
						"refund_status":   order.RefundStatus,
						"payment_method":  order.PaymentMethod,
						"service_title":   serviceTitle,
						"service_id":      fmt.Sprintf("%d", order.ServiceID),
						"highlight_type":  "order_refund",
						"update_category": "refund",
					},
				})
			}
		} else {
			if target.Status != "" && !strings.EqualFold(prevPaymentStatus, order.PaymentStatus) {
				s.appendActivityLocked(&models.Activity{
					Type:        "order",
					Action:      "payment_status_updated",
					Title:       fmt.Sprintf("Status pembayaran order #%d", order.ID),
					Description: fmt.Sprintf("Status pembayaran: %s", order.PaymentStatus),
					ReferenceID: order.ID,
					Metadata: map[string]string{
						"payment_status":    order.PaymentStatus,
						"payment_method":    order.PaymentMethod,
						"payment_reference": order.PaymentReference,
						"service_title":     serviceTitle,
						"service_id":        fmt.Sprintf("%d", order.ServiceID),
						"highlight_type":    "order_payment",
						"update_category":   "payment",
					},
				})
			}
			if prevPaymentMethod != order.PaymentMethod && order.PaymentMethod != "" {
				s.appendActivityLocked(&models.Activity{
					Type:        "order",
					Action:      "payment_method_updated",
					Title:       fmt.Sprintf("Metode pembayaran order #%d", order.ID),
					Description: fmt.Sprintf("Metode pembayaran: %s", order.PaymentMethod),
					ReferenceID: order.ID,
					Metadata: map[string]string{
						"payment_status":  order.PaymentStatus,
						"payment_method":  order.PaymentMethod,
						"service_title":   serviceTitle,
						"service_id":      fmt.Sprintf("%d", order.ServiceID),
						"highlight_type":  "order_payment",
						"update_category": "payment",
					},
				})
			}
			s.applyOrderPaymentOutcomeLocked(order, prevOrderStatus, serviceTitle, "payment", now)
		}
		cloned := *order
		outOrder = &cloned
	}

	if err := s.persistLocked(); err != nil {
		return nil, nil, err
	}

	return clonePaymentTransaction(target), outOrder, nil
}

func (s *Store) ListPromoCodes() []models.PromoCode {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	out := make([]models.PromoCode, 0, len(s.data.PromoCodes))
	for _, promo := range s.data.PromoCodes {
		out = append(out, clonePromoCode(promo))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].ID > out[j].ID
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

func (s *Store) GetPromoCodeByID(id uint) (*models.PromoCode, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	for _, promo := range s.data.PromoCodes {
		if promo.ID == id {
			clone := clonePromoCode(promo)
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) GetPromoCodeByCode(code string) (*models.PromoCode, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	promo, ok := s.findPromoByCodeLocked(code)
	if !ok {
		return nil, false
	}
	clone := clonePromoCode(promo)
	return &clone, true
}

func (s *Store) CreatePromoCode(promo *models.PromoCode) (*models.PromoCode, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	promo.Code = normalizePromoCode(promo.Code)
	if promo.Code == "" {
		return nil, errors.New("promo code is required")
	}
	if existing, ok := s.findPromoByCodeLocked(promo.Code); ok && existing != nil {
		return nil, ErrPromoDuplicate
	}
	if promo.MaxUsage < 0 {
		promo.MaxUsage = 0
	}
	if promo.UsedCount < 0 {
		promo.UsedCount = 0
	}
	if promo.DiscountPercent < 0 {
		promo.DiscountPercent = 0
	}
	now := time.Now().UTC()
	promo.ID = s.nextID("promo_code")
	promo.CreatedAt = now
	promo.UpdatedAt = now
	if !promo.ValidFrom.IsZero() {
		promo.ValidFrom = promo.ValidFrom.UTC()
	}
	if !promo.ValidUntil.IsZero() {
		promo.ValidUntil = promo.ValidUntil.UTC()
	}
	clone := clonePromoCode(promo)
	s.data.PromoCodes = append(s.data.PromoCodes, &clone)
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return promo, nil
}

func (s *Store) UpdatePromoCode(id uint, update PromoCodeUpdate) (*models.PromoCode, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, promo := range s.data.PromoCodes {
		if promo.ID == id {
			if update.Code != nil {
				code := normalizePromoCode(*update.Code)
				if code == "" {
					return nil, errors.New("promo code is required")
				}
				if existing, ok := s.findPromoByCodeLocked(code); ok && existing != nil && existing.ID != promo.ID {
					return nil, ErrPromoDuplicate
				}
				promo.Code = code
			}
			if update.DiscountPercent != nil {
				value := *update.DiscountPercent
				if value < 0 {
					value = 0
				}
				promo.DiscountPercent = value
			}
			if update.MaxUsage != nil {
				value := *update.MaxUsage
				if value < 0 {
					value = 0
				}
				promo.MaxUsage = value
				if promo.MaxUsage > 0 && promo.UsedCount > promo.MaxUsage {
					promo.UsedCount = promo.MaxUsage
				}
			}
			if update.ValidFrom != nil {
				value := *update.ValidFrom
				if value.IsZero() {
					promo.ValidFrom = time.Time{}
				} else {
					promo.ValidFrom = value.UTC()
				}
			}
			if update.ValidUntil != nil {
				value := *update.ValidUntil
				if value.IsZero() {
					promo.ValidUntil = time.Time{}
				} else {
					promo.ValidUntil = value.UTC()
				}
			}
			if update.Active != nil {
				promo.Active = *update.Active
			}
			if update.UsedCount != nil {
				value := *update.UsedCount
				if value < 0 {
					value = 0
				}
				promo.UsedCount = value
				if promo.MaxUsage > 0 && promo.UsedCount > promo.MaxUsage {
					promo.UsedCount = promo.MaxUsage
				}
			}
			promo.UpdatedAt = time.Now().UTC()
			clone := clonePromoCode(promo)
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			return &clone, nil
		}
	}
	return nil, ErrPromoNotFound
}

func (s *Store) DeletePromoCode(id uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	filtered := s.data.PromoCodes[:0]
	var removed bool
	for _, promo := range s.data.PromoCodes {
		if promo.ID == id {
			removed = true
			continue
		}
		filtered = append(filtered, promo)
	}
	s.data.PromoCodes = filtered
	if !removed {
		return ErrPromoNotFound
	}
	return s.persistLocked()
}

func (s *Store) GetOrderByID(id uint) (*models.Order, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	for _, o := range s.data.Orders {
		if o.ID == id {
			clone := *o
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) CreateOrder(order *models.Order) (*models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	now := time.Now().UTC()
	baseAmount := order.Amount
	if baseAmount < 0 {
		baseAmount = 0
	}
	order.Amount = roundCurrency(baseAmount)
	if order.PromoCode != "" {
		order.PromoCode = normalizePromoCode(order.PromoCode)
		promo, ok := s.findPromoByCodeLocked(order.PromoCode)
		if !ok {
			return nil, ErrPromoNotFound
		}
		if err := s.validatePromoLocked(promo, now); err != nil {
			return nil, err
		}
		order.PromoDiscountPercent = promo.DiscountPercent
		discount := roundCurrency(order.Amount * promo.DiscountPercent / 100)
		if discount > order.Amount {
			discount = order.Amount
		}
		order.PromoDiscountAmount = discount
		order.Amount = roundCurrency(order.Amount - discount)
		promo.UsedCount++
		promo.UpdatedAt = now
	} else {
		order.PromoCode = ""
		order.PromoDiscountPercent = 0
		order.PromoDiscountAmount = 0
	}
	if order.Amount < 0 {
		order.Amount = 0
	}
	order.ID = s.nextID("order")
	order.CreatedAt = now
	order.UpdatedAt = now
	if order.Status == "" {
		order.Status = "pending"
	}
	clone := *order
	s.data.Orders = append(s.data.Orders, &clone)
	serviceTitle := s.serviceTitleLocked(order.ServiceID)
	customer := order.CustomerName
	if customer == "" {
		customer = order.CustomerEmail
	}
	statusLabel := formatStatus(order.Status)
	description := fmt.Sprintf("Status: %s", statusLabel)
	if serviceTitle != "" && statusLabel != "" {
		description = fmt.Sprintf("%s • %s", serviceTitle, statusLabel)
	} else if serviceTitle != "" {
		description = serviceTitle
	} else if statusLabel == "" {
		description = "Order baru"
	}
	s.appendActivityLocked(&models.Activity{
		Type:        "order",
		Action:      "created",
		Title:       fmt.Sprintf("Order #%d dibuat", order.ID),
		Description: description,
		ReferenceID: order.ID,
		Metadata: map[string]string{
			"status":         order.Status,
			"status_label":   statusLabel,
			"service_title":  serviceTitle,
			"service_id":     fmt.Sprintf("%d", order.ServiceID),
			"customer_name":  customer,
			"customer_email": order.CustomerEmail,
			"amount":         fmt.Sprintf("%.2f", order.Amount),
			"highlight_type": "order_created",
		},
	})
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return order, nil
}

func (s *Store) UpdateRequest(id uint, newStatus, reason string) (*models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, o := range s.data.Orders {
		if o.ID == id {
			prevStatus := o.Status
			o.Status = newStatus
			o.RequestReason = reason
			if strings.Contains(strings.ToLower(newStatus), "cancel") {
				o.CancelReason = reason
			} else if !IsCancelledStatus(newStatus) {
				o.CancelReason = ""
			}
			if newStatus == "refund_pending" {
				o.RefundStatus = "pending_review"
			}
			o.UpdatedAt = time.Now().UTC()
			statusLabel := formatStatus(newStatus)
			prevStatusLabel := formatStatus(prevStatus)
			serviceTitle := s.serviceTitleLocked(o.ServiceID)
			desc := fmt.Sprintf("Dari %s ke %s", prevStatusLabel, statusLabel)
			if reason != "" {
				desc = fmt.Sprintf("%s • Alasan: %s", desc, reason)
			}
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "request_updated",
				Title:       fmt.Sprintf("Order #%d diperbarui", o.ID),
				Description: desc,
				ReferenceID: o.ID,
				Metadata: map[string]string{
					"status":          newStatus,
					"status_label":    statusLabel,
					"previous_status": prevStatus,
					"previous_label":  prevStatusLabel,
					"service_title":   serviceTitle,
					"service_id":      fmt.Sprintf("%d", o.ServiceID),
					"reason":          reason,
					"highlight_type":  "order_status",
					"update_category": "request",
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := *o
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) UpdateOrderStatus(id uint, status string) (*models.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, o := range s.data.Orders {
		if o.ID == id {
			prevStatus := o.Status
			o.Status = status
			if !IsCancelledStatus(status) {
				o.CancelReason = ""
			}
			o.UpdatedAt = time.Now().UTC()
			statusLabel := formatStatus(status)
			prevStatusLabel := formatStatus(prevStatus)
			serviceTitle := s.serviceTitleLocked(o.ServiceID)
			desc := fmt.Sprintf("Dari %s ke %s", prevStatusLabel, statusLabel)
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "status_changed",
				Title:       fmt.Sprintf("Status order #%d", o.ID),
				Description: desc,
				ReferenceID: o.ID,
				Metadata: map[string]string{
					"status":          status,
					"status_label":    statusLabel,
					"previous_status": prevStatus,
					"previous_label":  prevStatusLabel,
					"service_title":   serviceTitle,
					"service_id":      fmt.Sprintf("%d", o.ServiceID),
					"highlight_type":  "order_status",
					"update_category": "manual",
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := *o
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) SetOrderRating(id uint, rating int, review string) (*models.Order, error) {
	if rating < 1 || rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, o := range s.data.Orders {
		if o.ID == id {
			if o.Status != "done" {
				return nil, errors.New("order is not marked as done")
			}
			o.RatingValue = rating
			o.RatingReview = review
			now := time.Now().UTC()
			o.RatedAt = now
			o.UpdatedAt = now
			serviceTitle := s.serviceTitleLocked(o.ServiceID)
			desc := fmt.Sprintf("Rating %d/5", rating)
			if review != "" {
				desc = fmt.Sprintf("%s • \"%s\"", desc, review)
			}
			s.appendActivityLocked(&models.Activity{
				Type:        "order",
				Action:      "rated",
				Title:       fmt.Sprintf("Order #%d diberi rating", o.ID),
				Description: desc,
				ReferenceID: o.ID,
				Metadata: map[string]string{
					"rating":         fmt.Sprintf("%d", rating),
					"review":         review,
					"service_title":  serviceTitle,
					"service_id":     fmt.Sprintf("%d", o.ServiceID),
					"highlight_type": "order_feedback",
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := *o
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) DeleteOrder(id uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	filtered := s.data.Orders[:0]
	var deleted *models.Order
	for _, o := range s.data.Orders {
		if o.ID != id {
			filtered = append(filtered, o)
		} else {
			clone := *o
			deleted = &clone
		}
	}
	s.data.Orders = filtered
	if deleted != nil {
		serviceTitle := s.serviceTitleLocked(deleted.ServiceID)
		statusLabel := formatStatus(deleted.Status)
		s.appendActivityLocked(&models.Activity{
			Type:        "order",
			Action:      "deleted",
			Title:       fmt.Sprintf("Order #%d dihapus", deleted.ID),
			Description: fmt.Sprintf("Status terakhir: %s", statusLabel),
			ReferenceID: deleted.ID,
			Metadata: map[string]string{
				"status":         deleted.Status,
				"status_label":   statusLabel,
				"service_title":  serviceTitle,
				"service_id":     fmt.Sprintf("%d", deleted.ServiceID),
				"highlight_type": "order_removed",
			},
		})
	}
	return s.persistLocked()
}

func (s *Store) ListMessages() []models.Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	out := make([]models.Message, 0, len(s.data.Messages))
	for _, m := range s.data.Messages {
		out = append(out, *m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *Store) ListActivities(limit int) []models.Activity {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	total := len(s.data.Activities)
	if total == 0 {
		return nil
	}
	if limit <= 0 || limit > total {
		limit = total
	}
	out := make([]models.Activity, 0, limit)
	for i := total - 1; i >= 0 && len(out) < limit; i-- {
		out = append(out, cloneActivity(s.data.Activities[i]))
	}
	return out
}

func (s *Store) CreateMessage(msg *models.Message) (*models.Message, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	msg.ID = s.nextID("message")
	now := time.Now().UTC()
	msg.CreatedAt = now
	msg.UpdatedAt = now
	clone := *msg
	s.data.Messages = append(s.data.Messages, &clone)
	s.appendActivityLocked(&models.Activity{
		Type:        "message",
		Action:      "received",
		Title:       fmt.Sprintf("Pesan baru dari %s", msg.Name),
		Description: msg.Subject,
		ReferenceID: msg.ID,
		Metadata: map[string]string{
			"email":          msg.Email,
			"subject":        msg.Subject,
			"highlight_type": "message",
		},
	})
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return msg, nil
}

func normalizePromoCode(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, " ", "")
	return value
}

func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

func (s *Store) findPromoByCodeLocked(code string) (*models.PromoCode, bool) {
	normalized := normalizePromoCode(code)
	for _, promo := range s.data.PromoCodes {
		if normalizePromoCode(promo.Code) == normalized {
			return promo, true
		}
	}
	return nil, false
}

func (s *Store) validatePromoLocked(promo *models.PromoCode, now time.Time) error {
	if promo == nil {
		return ErrPromoNotFound
	}
	if !promo.Active {
		return ErrPromoInactive
	}
	if !promo.ValidFrom.IsZero() && now.Before(promo.ValidFrom) {
		return ErrPromoNotStarted
	}
	if !promo.ValidUntil.IsZero() && now.After(promo.ValidUntil) {
		return ErrPromoExpired
	}
	if promo.MaxUsage > 0 && promo.UsedCount >= promo.MaxUsage {
		return ErrPromoUsageExceeded
	}
	return nil
}

func normalizeGallerySection(section string) string {
	return strings.TrimSpace(strings.ToLower(section))
}

func normalizeGalleryDisplayMode(mode string) string {
	return strings.TrimSpace(strings.ToLower(mode))
}

func sanitizeFilters(filters []string) []string {
	if len(filters) == 0 {
		return nil
	}
	out := make([]string, 0, len(filters))
	seen := make(map[string]struct{})
	for _, f := range filters {
		val := strings.TrimSpace(f)
		if val == "" {
			continue
		}
		lower := strings.ToLower(val)
		if _, exists := seen[lower]; exists {
			continue
		}
		seen[lower] = struct{}{}
		out = append(out, val)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func sanitizeAssets(assets []models.GalleryAsset) []models.GalleryAsset {
	if len(assets) == 0 {
		return nil
	}
	out := make([]models.GalleryAsset, 0, len(assets))
	for _, asset := range assets {
		asset.Type = normalizeGalleryDisplayMode(asset.Type)
		if asset.Type == "" {
			asset.Type = "image"
		}
		asset.URL = strings.TrimSpace(asset.URL)
		if asset.URL == "" {
			continue
		}
		asset.Caption = strings.TrimSpace(asset.Caption)
		out = append(out, asset)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func (s *Store) ListGalleryItems(section string) []models.GalleryItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	normalized := normalizeGallerySection(section)
	out := make([]models.GalleryItem, 0, len(s.data.GalleryItems))
	for _, item := range s.data.GalleryItems {
		if normalized != "" && normalizeGallerySection(item.Section) != normalized {
			continue
		}
		out = append(out, cloneGalleryItem(item))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return strings.ToLower(out[i].Title) < strings.ToLower(out[j].Title)
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

func (s *Store) GetGalleryItemByID(id uint) (*models.GalleryItem, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	for _, item := range s.data.GalleryItems {
		if item.ID == id {
			clone := cloneGalleryItem(item)
			return &clone, true
		}
	}
	return nil, false
}

func (s *Store) CreateGalleryItem(item *models.GalleryItem) (*models.GalleryItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	now := time.Now().UTC()
	item.ID = s.nextID("gallery_item")
	item.Section = normalizeGallerySection(item.Section)
	item.DisplayMode = normalizeGalleryDisplayMode(item.DisplayMode)
	item.Filters = sanitizeFilters(item.Filters)
	item.Assets = sanitizeAssets(item.Assets)
	item.Title = strings.TrimSpace(item.Title)
	item.Subtitle = strings.TrimSpace(item.Subtitle)
	item.Thumbnail = strings.TrimSpace(item.Thumbnail)
	item.VideoURL = strings.TrimSpace(item.VideoURL)
	item.LinkURL = strings.TrimSpace(item.LinkURL)
	item.Description = strings.TrimSpace(item.Description)
	item.CreatedAt = now
	item.UpdatedAt = now
	clone := cloneGalleryItem(item)
	clone.CreatedAt = item.CreatedAt
	clone.UpdatedAt = item.UpdatedAt
	s.data.GalleryItems = append(s.data.GalleryItems, &clone)
	s.appendActivityLocked(&models.Activity{
		Type:        "gallery",
		Action:      "created",
		Title:       fmt.Sprintf("Galeri \"%s\" ditambahkan", item.Title),
		Description: fmt.Sprintf("Bagian: %s", formatStatus(item.Section)),
		ReferenceID: item.ID,
		Metadata: map[string]string{
			"title":   item.Title,
			"section": item.Section,
		},
	})
	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Store) UpdateGalleryItem(id uint, update *models.GalleryItem) (*models.GalleryItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	for _, item := range s.data.GalleryItems {
		if item.ID == id {
			prev := cloneGalleryItem(item)
			if update.Section != "" {
				item.Section = normalizeGallerySection(update.Section)
			}
			if update.Title != "" {
				item.Title = strings.TrimSpace(update.Title)
			}
			item.Subtitle = strings.TrimSpace(update.Subtitle)
			if update.Thumbnail != "" {
				item.Thumbnail = strings.TrimSpace(update.Thumbnail)
			}
			item.DisplayMode = normalizeGalleryDisplayMode(update.DisplayMode)
			item.Filters = sanitizeFilters(update.Filters)
			item.Assets = sanitizeAssets(update.Assets)
			item.VideoURL = strings.TrimSpace(update.VideoURL)
			item.LinkURL = strings.TrimSpace(update.LinkURL)
			item.Description = strings.TrimSpace(update.Description)
			item.UpdatedAt = time.Now().UTC()
			s.appendActivityLocked(&models.Activity{
				Type:        "gallery",
				Action:      "updated",
				Title:       fmt.Sprintf("Galeri \"%s\" diperbarui", item.Title),
				Description: fmt.Sprintf("Bagian: %s", formatStatus(item.Section)),
				ReferenceID: item.ID,
				Metadata: map[string]string{
					"title":       item.Title,
					"section":     item.Section,
					"old_title":   prev.Title,
					"old_section": prev.Section,
				},
			})
			if err := s.persistLocked(); err != nil {
				return nil, err
			}
			clone := cloneGalleryItem(item)
			return &clone, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *Store) DeleteGalleryItem(id uint) (*models.GalleryItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	filtered := s.data.GalleryItems[:0]
	var deleted *models.GalleryItem
	for _, item := range s.data.GalleryItems {
		if item.ID != id {
			filtered = append(filtered, item)
			continue
		}
		clone := cloneGalleryItem(item)
		deleted = &clone
	}
	s.data.GalleryItems = filtered
	if deleted != nil {
		s.appendActivityLocked(&models.Activity{
			Type:        "gallery",
			Action:      "deleted",
			Title:       fmt.Sprintf("Galeri \"%s\" dihapus", deleted.Title),
			Description: fmt.Sprintf("Bagian: %s", formatStatus(deleted.Section)),
			ReferenceID: deleted.ID,
			Metadata: map[string]string{
				"title":   deleted.Title,
				"section": deleted.Section,
			},
		})
		if err := s.persistLocked(); err != nil {
			return nil, err
		}
		return deleted, nil
	}
	return nil, os.ErrNotExist
}
func (s *Store) ValidatePromoCode(code string, now time.Time) (*models.PromoCode, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()
	promo, ok := s.findPromoByCodeLocked(code)
	if !ok {
		return nil, ErrPromoNotFound
	}
	if err := s.validatePromoLocked(promo, now); err != nil {
		return nil, err
	}
	clone := clonePromoCode(promo)
	return &clone, nil
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, " ", "-")
	value = strings.ReplaceAll(value, "_", "-")
	for strings.Contains(value, "--") {
		value = strings.ReplaceAll(value, "--", "-")
	}
	value = strings.Trim(value, "-")
	return value
}

func (s *Store) CountServices() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.data.Services)
}

func (s *Store) CountOrders() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.data.Orders)
}

func (s *Store) CountMessages() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.data.Messages)
}

func (s *Store) RecordAnalyticsEvent(event *models.AnalyticsEvent) (*models.AnalyticsEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()

	if event.SessionID == "" {
		event.SessionID = fmt.Sprintf("session-%d", time.Now().UnixNano())
	}
	if event.VisitorID == "" {
		event.VisitorID = fmt.Sprintf("visitor-%d", time.Now().UnixNano())
	}
	if strings.TrimSpace(event.EventType) == "" {
		event.EventType = "custom"
	}
	if strings.TrimSpace(event.EventName) == "" {
		event.EventName = event.EventType
	}
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	} else {
		event.OccurredAt = event.OccurredAt.UTC()
	}

	event.ID = s.nextID("analytics_event")
	clone := cloneAnalyticsEvent(event)
	s.data.AnalyticsEvents = append(s.data.AnalyticsEvents, &clone)
	s.updateAnalyticsSessionLocked(event)
	s.pruneAnalyticsLocked(event.OccurredAt)

	if err := s.persistLocked(); err != nil {
		return nil, err
	}
	return event, nil
}

func (s *Store) updateAnalyticsSessionLocked(event *models.AnalyticsEvent) {
	var session *models.AnalyticsSession
	for _, sess := range s.data.AnalyticsSessions {
		if sess.SessionID == event.SessionID {
			session = sess
			break
		}
	}

	if session == nil {
		session = &models.AnalyticsSession{
			ID:        s.nextID("analytics_session"),
			SessionID: event.SessionID,
			VisitorID: event.VisitorID,
			FirstSeen: event.OccurredAt,
			LastSeen:  event.OccurredAt,
			Referrer:  event.Referrer,
			Country:   event.Country,
			Traffic: models.AnalyticsTrafficSource{
				Source:   event.UTMSource,
				Medium:   event.UTMMedium,
				Campaign: event.UTMCampaign,
				Term:     event.UTMTerm,
				Content:  event.UTMContent,
			},
		}
		s.data.AnalyticsSessions = append(s.data.AnalyticsSessions, session)
	}

	if session.VisitorID == "" {
		session.VisitorID = event.VisitorID
	}
	if session.Referrer == "" && event.Referrer != "" {
		session.Referrer = event.Referrer
	}
	if session.Country == "" && event.Country != "" {
		session.Country = event.Country
	}
	if session.Traffic.Source == "" && event.UTMSource != "" {
		session.Traffic.Source = event.UTMSource
	}
	if session.Traffic.Medium == "" && event.UTMMedium != "" {
		session.Traffic.Medium = event.UTMMedium
	}
	if session.Traffic.Campaign == "" && event.UTMCampaign != "" {
		session.Traffic.Campaign = event.UTMCampaign
	}
	if session.Traffic.Term == "" && event.UTMTerm != "" {
		session.Traffic.Term = event.UTMTerm
	}
	if session.Traffic.Content == "" && event.UTMContent != "" {
		session.Traffic.Content = event.UTMContent
	}

	if event.OccurredAt.Before(session.FirstSeen) {
		session.FirstSeen = event.OccurredAt
	}
	if event.OccurredAt.After(session.LastSeen) {
		session.LastSeen = event.OccurredAt
	}

	session.EventCount++
	if strings.EqualFold(event.EventType, "page_view") {
		session.PageViews++
		if event.PagePath != "" {
			if l := len(session.PageSequence); l == 0 || session.PageSequence[l-1] != event.PagePath {
				if len(session.PageSequence) >= maxPageSequenceLength {
					session.PageSequence = append(session.PageSequence[1:], event.PagePath)
				} else {
					session.PageSequence = append(session.PageSequence, event.PagePath)
				}
			}
		}
	}
}

func (s *Store) ListAnalyticsEvents(filter AnalyticsEventFilter) []models.AnalyticsEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()

	start := filter.Start
	end := filter.End
	if end.IsZero() {
		end = time.Now().UTC()
	}
	if start.IsZero() {
		start = end.Add(-24 * time.Hour)
	}
	if start.After(end) {
		start, end = end.Add(-24*time.Hour), end
	}

	var out []models.AnalyticsEvent
	for i := len(s.data.AnalyticsEvents) - 1; i >= 0; i-- {
		ev := s.data.AnalyticsEvents[i]
		if ev.OccurredAt.Before(start) || ev.OccurredAt.After(end) {
			continue
		}
		if filter.EventType != "" && !strings.EqualFold(ev.EventType, filter.EventType) {
			continue
		}
		if filter.SessionID != "" && ev.SessionID != filter.SessionID {
			continue
		}
		if filter.VisitorID != "" && ev.VisitorID != filter.VisitorID {
			continue
		}
		out = append(out, cloneAnalyticsEvent(ev))
		if filter.Limit > 0 && len(out) >= filter.Limit {
			break
		}
	}
	return out
}

func (s *Store) GetAnalyticsSummary(opts AnalyticsSummaryOptions) AnalyticsSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	s.ensureLoaded()

	now := time.Now().UTC()
	end := opts.End
	if end.IsZero() {
		end = now
	} else {
		end = end.UTC()
	}
	start := opts.Start
	if start.IsZero() {
		start = end.Add(-7 * 24 * time.Hour)
	} else {
		start = start.UTC()
	}
	if start.After(end) {
		start = end.Add(-24 * time.Hour)
	}
	resolution := strings.ToLower(strings.TrimSpace(opts.Resolution))
	if resolution == "" {
		resolution = "day"
	}
	recentLimit := opts.RecentLimit
	if recentLimit <= 0 {
		recentLimit = 30
	}

	sessionsInRange := make([]*models.AnalyticsSession, 0)
	for _, sess := range s.data.AnalyticsSessions {
		if sess.LastSeen.Before(start) || sess.FirstSeen.After(end) {
			continue
		}
		copy := cloneAnalyticsSession(sess)
		sessionsInRange = append(sessionsInRange, &copy)
	}

	eventsInRange := make([]*models.AnalyticsEvent, 0)
	for _, ev := range s.data.AnalyticsEvents {
		if ev.OccurredAt.Before(start) || ev.OccurredAt.After(end) {
			continue
		}
		copy := cloneAnalyticsEvent(ev)
		eventsInRange = append(eventsInRange, &copy)
	}

	uniqueVisitors := make(map[string]struct{})
	totalPageViews := 0
	totalEvents := len(eventsInRange)
	totalSessions := len(sessionsInRange)
	var sessionDurationSum time.Duration
	pageViewEvents := 0

	for _, sess := range sessionsInRange {
		if sess.VisitorID != "" {
			uniqueVisitors[sess.VisitorID] = struct{}{}
		}
		totalPageViews += sess.PageViews
		if sess.LastSeen.After(sess.FirstSeen) {
			sessionDurationSum += sess.LastSeen.Sub(sess.FirstSeen)
		}
	}

	averageDuration := 0.0
	if totalSessions > 0 {
		averageDuration = sessionDurationSum.Seconds() / float64(totalSessions)
	}

	visitorsByBucket := make(map[string]map[string]struct{})
	sessionsByBucket := make(map[string]int)
	pageViewsByBucket := make(map[string]int)
	interactionByBucket := make(map[string]int)

	for _, sess := range sessionsInRange {
		bucket := bucketKey(sess.FirstSeen, start, resolution)
		if _, ok := visitorsByBucket[bucket]; !ok {
			visitorsByBucket[bucket] = make(map[string]struct{})
		}
		if sess.VisitorID != "" {
			visitorsByBucket[bucket][sess.VisitorID] = struct{}{}
		}
		sessionsByBucket[bucket]++
		pageViewsByBucket[bucket] += sess.PageViews
	}

	for _, ev := range eventsInRange {
		if !strings.EqualFold(ev.EventType, "page_view") {
			bucket := bucketKey(ev.OccurredAt, start, resolution)
			interactionByBucket[bucket]++
		}
	}

	timeseriesMap := make(map[string]AnalyticsTimeseriesPoint)
	for bucket, visitors := range visitorsByBucket {
		pt := timeseriesMap[bucket]
		pt.Bucket = bucket
		pt.Visitors = len(visitors)
		pt.Sessions = sessionsByBucket[bucket]
		pt.PageViews = pageViewsByBucket[bucket]
		pt.Interactions = interactionByBucket[bucket]
		timeseriesMap[bucket] = pt
	}

	timeseries := make([]AnalyticsTimeseriesPoint, 0, len(timeseriesMap))
	for _, pt := range timeseriesMap {
		timeseries = append(timeseries, pt)
	}
	sort.Slice(timeseries, func(i, j int) bool { return timeseries[i].Bucket < timeseries[j].Bucket })

	sourceCount := make(map[string]int)
	pageViews := make(map[string]int)
	pageUnique := make(map[string]map[string]struct{})
	flowCount := make(map[string]int)
	interactionCount := make(map[string]AnalyticsInteractionStat)

	for _, sess := range sessionsInRange {
		sourceKey := buildSourceKey(sess)
		sourceCount[sourceKey]++
		for i := 0; i < len(sess.PageSequence)-1; i++ {
			from := sess.PageSequence[i]
			to := sess.PageSequence[i+1]
			if from == "" || to == "" {
				continue
			}
			key := from + "→" + to
			flowCount[key]++
		}
	}

	for _, ev := range eventsInRange {
		if strings.EqualFold(ev.EventType, "page_view") {
			pageViewEvents++
		}
		if ev.PagePath != "" && strings.EqualFold(ev.EventType, "page_view") {
			pageViews[ev.PagePath]++
			if _, ok := pageUnique[ev.PagePath]; !ok {
				pageUnique[ev.PagePath] = make(map[string]struct{})
			}
			if ev.VisitorID != "" {
				pageUnique[ev.PagePath][ev.VisitorID] = struct{}{}
			}
		}
		if !strings.EqualFold(ev.EventType, "page_view") {
			key := strings.ToLower(ev.EventName)
			stat := interactionCount[key]
			stat.EventName = ev.EventName
			stat.EventType = ev.EventType
			stat.Count++
			interactionCount[key] = stat
		}
	}

	sourceStats := make([]AnalyticsSourceStat, 0, len(sourceCount))
	for key, count := range sourceCount {
		src := parseSourceKey(key)
		src.Count = count
		sourceStats = append(sourceStats, src)
	}
	sort.Slice(sourceStats, func(i, j int) bool { return sourceStats[i].Count > sourceStats[j].Count })
	if len(sourceStats) > 10 {
		sourceStats = sourceStats[:10]
	}

	pageStats := make([]AnalyticsPageStat, 0, len(pageViews))
	for path, views := range pageViews {
		stat := AnalyticsPageStat{
			PagePath: path,
			Views:    views,
			Uniques:  len(pageUnique[path]),
		}
		pageStats = append(pageStats, stat)
	}
	sort.Slice(pageStats, func(i, j int) bool { return pageStats[i].Views > pageStats[j].Views })
	if len(pageStats) > 15 {
		pageStats = pageStats[:15]
	}

	flows := make([]AnalyticsFlowStat, 0, len(flowCount))
	for key, count := range flowCount {
		parts := strings.Split(key, "→")
		if len(parts) != 2 {
			continue
		}
		flows = append(flows, AnalyticsFlowStat{
			From:  parts[0],
			To:    parts[1],
			Count: count,
		})
	}
	sort.Slice(flows, func(i, j int) bool { return flows[i].Count > flows[j].Count })
	if len(flows) > 20 {
		flows = flows[:20]
	}

	interactionStats := make([]AnalyticsInteractionStat, 0, len(interactionCount))
	for _, stat := range interactionCount {
		interactionStats = append(interactionStats, stat)
	}
	sort.Slice(interactionStats, func(i, j int) bool { return interactionStats[i].Count > interactionStats[j].Count })
	if len(interactionStats) > 20 {
		interactionStats = interactionStats[:20]
	}

	recentEvents := make([]models.AnalyticsEvent, 0, recentLimit)
	for i := len(eventsInRange) - 1; i >= 0 && len(recentEvents) < recentLimit; i-- {
		recentEvents = append(recentEvents, cloneAnalyticsEvent(eventsInRange[i]))
	}

	if pageViewEvents > 0 {
		totalPageViews = pageViewEvents
	}

	return AnalyticsSummary{
		RangeStart:             start,
		RangeEnd:               end,
		TotalVisitors:          pageViewEvents,
		UniqueVisitors:         len(uniqueVisitors),
		TotalSessions:          totalSessions,
		TotalPageViews:         totalPageViews,
		TotalEvents:            totalEvents,
		AverageSessionDuration: averageDuration,
		Timeseries:             timeseries,
		SourceBreakdown:        sourceStats,
		TopPages:               pageStats,
		PageFlows:              flows,
		InteractionBreakdown:   interactionStats,
		RecentEvents:           recentEvents,
	}
}

func bucketKey(t time.Time, start time.Time, resolution string) string {
	switch resolution {
	case "hour":
		return t.UTC().Format("2006-01-02 15:00")
	case "week":
		year, week := t.UTC().ISOWeek()
		return fmt.Sprintf("%d-W%02d", year, week)
	case "month":
		return t.UTC().Format("2006-01")
	default:
		return t.UTC().Format("2006-01-02")
	}
}

func buildSourceKey(sess *models.AnalyticsSession) string {
	source := strings.TrimSpace(sess.Traffic.Source)
	medium := strings.TrimSpace(sess.Traffic.Medium)
	campaign := strings.TrimSpace(sess.Traffic.Campaign)
	if source == "" {
		if sess.Referrer != "" {
			source = sess.Referrer
		} else {
			source = "Direct"
		}
	}
	if medium == "" {
		if sess.Referrer != "" {
			medium = "referral"
		} else {
			medium = "direct"
		}
	}
	keyParts := []string{source, medium, campaign}
	return strings.Join(keyParts, "|")
}

func parseSourceKey(key string) AnalyticsSourceStat {
	parts := strings.Split(key, "|")
	stat := AnalyticsSourceStat{}
	if len(parts) > 0 {
		stat.Source = parts[0]
	}
	if len(parts) > 1 {
		stat.Medium = parts[1]
	}
	if len(parts) > 2 {
		stat.Campaign = parts[2]
	}
	return stat
}

func (s *Store) pruneAnalyticsLocked(now time.Time) {
	retentionCutoff := now.Add(-analyticsRetentionDays * 24 * time.Hour)

	if len(s.data.AnalyticsEvents) > 0 {
		filtered := s.data.AnalyticsEvents[:0]
		for _, ev := range s.data.AnalyticsEvents {
			if ev.OccurredAt.Before(retentionCutoff) {
				continue
			}
			filtered = append(filtered, ev)
		}
		if len(filtered) > 1 {
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].OccurredAt.Before(filtered[j].OccurredAt)
			})
		}
		if maxStoredAnalyticsEvents > 0 && len(filtered) > maxStoredAnalyticsEvents {
			filtered = filtered[len(filtered)-maxStoredAnalyticsEvents:]
		}
		s.data.AnalyticsEvents = filtered
	}

	if len(s.data.AnalyticsSessions) > 0 {
		filteredSessions := s.data.AnalyticsSessions[:0]
		for _, sess := range s.data.AnalyticsSessions {
			if sess.LastSeen.Before(retentionCutoff) {
				continue
			}
			filteredSessions = append(filteredSessions, sess)
		}
		if len(filteredSessions) > 1 {
			sort.Slice(filteredSessions, func(i, j int) bool {
				return filteredSessions[i].LastSeen.Before(filteredSessions[j].LastSeen)
			})
		}
		if maxStoredAnalyticsSessions > 0 && len(filteredSessions) > maxStoredAnalyticsSessions {
			filteredSessions = filteredSessions[len(filteredSessions)-maxStoredAnalyticsSessions:]
		}
		s.data.AnalyticsSessions = filteredSessions
	}
}

func (s *Store) ensureSampleData() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureLoaded()
	changed := false
	if len(s.data.Categories) == 0 && len(s.data.Services) == 0 {
		photography := &models.Category{ID: s.nextID("category"), Name: "Photography", Slug: "photography"}
		videography := &models.Category{ID: s.nextID("category"), Name: "Videography", Slug: "videography"}
		design := &models.Category{ID: s.nextID("category"), Name: "Design", Slug: "design"}
		marketing := &models.Category{ID: s.nextID("category"), Name: "Marketing", Slug: "marketing"}
		s.data.Categories = append(s.data.Categories, photography, videography, design, marketing)
		services := []*models.Service{
			{ID: s.nextID("service"), Title: "Event Photography", Slug: "event-photography", Summary: "Capture your milestones with stunning imagery.", Description: "Professional event coverage with edited highlights delivered within 48 hours.", Price: 350.0, CategoryID: photography.ID},
			{ID: s.nextID("service"), Title: "Brand Video", Slug: "brand-video", Summary: "Tell your story through motion.", Description: "Script assistance, on-site filming and final edit optimised for social media.", Price: 640.0, CategoryID: videography.ID},
			{ID: s.nextID("service"), Title: "Logo & Identity", Slug: "logo-identity", Summary: "A bold identity system for modern brands.", Description: "Includes logo suite, colour palette, and usage guidelines.", Price: 520.0, CategoryID: design.ID},
			{ID: s.nextID("service"), Title: "Launch Campaign", Slug: "launch-campaign", Summary: "Full-funnel marketing support for product launches.", Description: "Channel planning, asset creation and performance reporting for 30-day campaigns.", Price: 890.0, CategoryID: marketing.ID},
		}
		s.data.Services = append(s.data.Services, services...)
		changed = true
	}
	if len(s.data.Experiences) == 0 {
		now := time.Now().UTC()
		experiences := []*models.Experience{
			{
				ID:          s.nextID("experience"),
				Period:      "2017",
				Title:       "Freelance Photographer",
				Company:     "Bali Creative Circle",
				Description: "Membuka perjalanan profesional dengan memotret kampanye brand lokal dan dokumentasi event budaya.",
				Order:       1,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
			{
				ID:          s.nextID("experience"),
				Period:      "2019",
				Title:       "Visual Storyteller",
				Company:     "Tide Atelier",
				Description: "Menggabungkan fotografi dan video storytelling untuk membawa kisah brand ke kanal digital dengan narasi menyeluruh.",
				Order:       2,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
			{
				ID:          s.nextID("experience"),
				Period:      "2022",
				Title:       "Creative Director",
				Company:     "Devara Creative Studio",
				Description: "Memimpin arahan kreatif lintas media, dari konsep hingga eksekusi, dengan fokus pada pengalaman brand yang tenang dan bernilai.",
				Order:       3,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
		}
		for _, exp := range experiences {
			clone := cloneExperience(exp)
			s.data.Experiences = append(s.data.Experiences, &clone)
		}
		changed = true
	}
	if !changed {
		return nil
	}
	return s.persistLocked()
}
