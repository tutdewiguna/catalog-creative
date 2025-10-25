package server

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"math/big"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"devara-creative-backend/app/auth"
	"devara-creative-backend/app/models"
	"devara-creative-backend/app/repository"
	"devara-creative-backend/app/storage"
	"devara-creative-backend/app/utils"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type Server struct {
	Store     *storage.Store
	UploadDir string

	googleOAuthConfig   *oauth2.Config
	googleStateSecret   []byte
	frontendBaseURL     string
	backendBaseURL      string
	defaultUserRedirect string

	sessionTTL            time.Duration
	sessionCookieName     string
	sessionCookieDomain   string
	sessionCookieSecure   bool
	sessionCookieSameSite http.SameSite

	allowedOrigins   map[string]struct{}
	allowAllOrigins  bool
	allowCredentials bool

	userRepo    repository.UserRepository
	sessionRepo repository.SessionRepository

	accessTokenSecret  string
	refreshTokenSecret string
	accessTokenTTL     time.Duration
	refreshTokenTTL    time.Duration

	sessionMu     sync.RWMutex
	localSessions map[string]*models.Session

	httpClient          *http.Client
	xenditAPIKey        string
	xenditBaseURL       string
	xenditCallbackToken string
	xenditRedirectURL   string

	paymentSyncInterval time.Duration
}

var (
	xenditBankTransferCodes    = []string{"BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "CIMB", "BSI", "BJB", "BSS"}
	xenditEWalletChannelCodes  = []string{"OVO", "DANA", "SHOPEEPAY", "LINKAJA", "ASTRAPAY"}
	xenditRetailOutletNames    = []string{"ALFAMART", "INDOMARET"}
	xenditPayLaterChannelCodes = []string{"AKULAKU", "KREDIVO"}
	errPaymentWindowClosed     = errors.New("payment window closed for this order")
)

type contextKey string

const (
	contextKeyOrder   contextKey = "payment-order"
	contextKeyPayment contextKey = "payment-transaction"
)

type userResponse struct {
	ID          uint      `json:"id"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	Picture     string    `json:"picture,omitempty"`
	Provider    string    `json:"provider,omitempty"`
	ProviderID  string    `json:"provider_id,omitempty"`
	HasPassword bool      `json:"has_password"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	LastLogin   time.Time `json:"last_login_at,omitempty"`
}

type authResponse struct {
	AccessToken string       `json:"access_token"`
	User        userResponse `json:"user"`
}

type serviceMetrics struct {
	ratingSum      int
	ratingCount    int
	completedCount int
}

type analyticsEventPayload struct {
	SessionID   string            `json:"session_id"`
	VisitorID   string            `json:"visitor_id"`
	EventType   string            `json:"event_type"`
	EventName   string            `json:"event_name"`
	PagePath    string            `json:"page_path"`
	PageTitle   string            `json:"page_title"`
	Referrer    string            `json:"referrer"`
	Country     string            `json:"country"`
	City        string            `json:"city"`
	Device      string            `json:"device"`
	Browser     string            `json:"browser"`
	OS          string            `json:"os"`
	UTMSource   string            `json:"utm_source"`
	UTMMedium   string            `json:"utm_medium"`
	UTMCampaign string            `json:"utm_campaign"`
	UTMTerm     string            `json:"utm_term"`
	UTMContent  string            `json:"utm_content"`
	OccurredAt  string            `json:"occurred_at"`
	Metadata    map[string]string `json:"metadata"`
}

type experiencePayload struct {
	Period      *string `json:"period"`
	Title       *string `json:"title"`
	Company     *string `json:"company"`
	Description *string `json:"description"`
	Order       *int    `json:"order"`
}

type paymentRequest struct {
	Category  string
	Channel   string
	CardToken string
}

func (p *experiencePayload) sanitize() {
	if p.Period != nil {
		*p.Period = strings.TrimSpace(*p.Period)
	}
	if p.Title != nil {
		*p.Title = strings.TrimSpace(*p.Title)
	}
	if p.Company != nil {
		*p.Company = strings.TrimSpace(*p.Company)
	}
	if p.Description != nil {
		*p.Description = strings.TrimSpace(*p.Description)
	}
}

func validateExperienceFields(period, title, company, description string) error {
	switch {
	case period == "":
		return errors.New("Periode pengalaman wajib diisi.")
	case len(period) > 64:
		return errors.New("Periode pengalaman terlalu panjang (maks 64 karakter).")
	case title == "":
		return errors.New("Judul pengalaman wajib diisi.")
	case len(title) > 160:
		return errors.New("Judul pengalaman terlalu panjang (maks 160 karakter).")
	case len(company) > 160:
		return errors.New("Nama perusahaan terlalu panjang (maks 160 karakter).")
	case description == "":
		return errors.New("Deskripsi pengalaman wajib diisi.")
	case len(description) > 2000:
		return errors.New("Deskripsi pengalaman terlalu panjang (maks 2000 karakter).")
	default:
		return nil
	}
}

const (
	defaultSessionCookieName = "cc_session"
	defaultUserRedirectPath  = "/dashboard"
	defaultFrontendBaseURL   = "http://localhost:3000"
	defaultBackendBaseURL    = "http://localhost:8000"
)

const (
	portalRoleAdmin = "admin"
	portalRoleUser  = "user"
)

const (
	ctxKeyPortalRole   contextKey = "portal_role"
	ctxKeyPortalUserID contextKey = "portal_user_id"
)

func envString(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val != "" {
		return val
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	switch strings.ToLower(val) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func envDurationMinutes(key string, fallback time.Duration) time.Duration {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	if mins, err := strconv.Atoi(val); err == nil && mins > 0 {
		return time.Duration(mins) * time.Minute
	}
	return fallback
}

func parseSameSite(value string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "none":
		return http.SameSiteNoneMode
	case "strict":
		return http.SameSiteStrictMode
	default:
		return http.SameSiteLaxMode
	}
}

func normalizeRedirectPath(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return defaultUserRedirectPath
	}
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return defaultUserRedirectPath
	}
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	return value
}

func trimTrailingSlashes(value string) string {
	value = strings.TrimSpace(value)
	for strings.HasSuffix(value, "/") && len(value) > 1 {
		value = strings.TrimSuffix(value, "/")
	}
	return value
}

func parseAllowedOrigins(raw string) (map[string]struct{}, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return map[string]struct{}{}, true
	}
	origins := make(map[string]struct{})
	for _, part := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins[origin] = struct{}{}
		}
	}
	if len(origins) == 0 {
		return origins, true
	}
	return origins, false
}

func pickCookieSameSite(site http.SameSite, secure bool) http.SameSite {
	if site == http.SameSiteNoneMode && !secure {
		return http.SameSiteLaxMode
	}
	return site
}

func (s *Server) frontendURL(path string, params url.Values) string {
	base := s.frontendBaseURL
	if base == "" {
		base = defaultFrontendBaseURL
	}
	base = trimTrailingSlashes(base)
	targetPath := normalizeRedirectPath(path)
	if targetPath == "" {
		targetPath = s.defaultUserRedirect
	}
	if targetPath == "" {
		targetPath = defaultUserRedirectPath
	}
	u := base + targetPath
	if params != nil && len(params) > 0 {
		separator := "?"
		if strings.Contains(u, "?") {
			separator = "&"
		}
		u += separator + params.Encode()
	}
	return u
}

func (s *Server) makeUserResponse(user *models.User) userResponse {
	if user == nil {
		return userResponse{}
	}
	return userResponse{
		ID:          user.ID,
		Email:       user.Email,
		Name:        user.Name,
		Picture:     user.Picture,
		Provider:    user.Provider,
		ProviderID:  user.ProviderID,
		HasPassword: strings.TrimSpace(user.PasswordHash) != "",
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
		LastLogin:   user.LastLogin,
	}
}

func (s *Server) newAuthResponse(token string, user *models.User) authResponse {
	return authResponse{
		AccessToken: token,
		User:        s.makeUserResponse(user),
	}
}

func isValidEmail(email string) bool {
	email = strings.TrimSpace(email)
	if email == "" {
		return false
	}
	return strings.Contains(email, "@")
}

type googleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	VerifiedEmail bool   `json:"verified_email"`
}

func (s *Server) fetchGoogleUser(ctx context.Context, tok *oauth2.Token) (*googleUserInfo, error) {
	if s.googleOAuthConfig == nil {
		return nil, errors.New("google oauth not configured")
	}
	client := s.googleOAuthConfig.Client(ctx, tok)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("google userinfo request failed: %s", strings.TrimSpace(string(body)))
	}
	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	if strings.TrimSpace(info.Email) == "" {
		return nil, errors.New("google account missing email")
	}
	return &info, nil
}

func (s *Server) buildOAuthState(redirect, mode, provider string) (string, error) {
	if len(s.googleStateSecret) == 0 {
		return "", errors.New("state secret not configured")
	}
	redirect = normalizeRedirectPath(redirect)
	mode = strings.TrimSpace(strings.ToLower(mode))
	if mode == "" {
		mode = "login"
	}
	provider = strings.TrimSpace(strings.ToLower(provider))
	if provider == "" {
		provider = "google"
	}
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	expiry := time.Now().Add(10 * time.Minute).Unix()
	payloadParts := []string{
		redirect,
		mode,
		provider,
		fmt.Sprintf("%d", expiry),
		base64.RawURLEncoding.EncodeToString(nonce),
	}
	payload := strings.Join(payloadParts, "|")
	mac := hmac.New(sha256.New, s.googleStateSecret)
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	statePayload := payload + "|" + sig
	return base64.RawURLEncoding.EncodeToString([]byte(statePayload)), nil
}

func (s *Server) verifyOAuthState(raw string) (redirect, mode, provider string, err error) {
	if raw == "" {
		return "", "", "", errors.New("missing state")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return "", "", "", errors.New("invalid state encoding")
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 6 {
		return "", "", "", errors.New("invalid state format")
	}
	payloadParts := parts[:5]
	providedSig, err := base64.RawURLEncoding.DecodeString(parts[5])
	if err != nil {
		return "", "", "", errors.New("invalid state signature")
	}
	payload := strings.Join(payloadParts, "|")
	mac := hmac.New(sha256.New, s.googleStateSecret)
	mac.Write([]byte(payload))
	expectedSig := mac.Sum(nil)
	if !hmac.Equal(providedSig, expectedSig) {
		return "", "", "", errors.New("state signature mismatch")
	}
	if _, err := base64.RawURLEncoding.DecodeString(payloadParts[4]); err != nil {
		return "", "", "", errors.New("invalid state nonce")
	}
	expiry, err := strconv.ParseInt(payloadParts[3], 10, 64)
	if err != nil {
		return "", "", "", errors.New("invalid state expiry")
	}
	if time.Now().Unix() > expiry {
		return "", "", "", errors.New("state expired")
	}
	redirect = normalizeRedirectPath(payloadParts[0])
	mode = strings.TrimSpace(payloadParts[1])
	provider = strings.TrimSpace(payloadParts[2])
	return redirect, mode, provider, nil
}

var allowedEventTypes = map[string]struct{}{
	"page_view":   {},
	"interaction": {},
	"conversion":  {},
}

var allowedInteractionEvents = map[string]struct{}{
	"add_to_cart":           {},
	"product_view":          {},
	"hero_explore_services": {},
	"services_cta":          {},
	"view_previous_page":    {},
	"cta_click":             {},
	"contact_submit":        {},
}

func (p analyticsEventPayload) toModel() *models.AnalyticsEvent {
	event := &models.AnalyticsEvent{
		SessionID:   strings.TrimSpace(p.SessionID),
		VisitorID:   strings.TrimSpace(p.VisitorID),
		EventType:   strings.TrimSpace(p.EventType),
		EventName:   strings.TrimSpace(p.EventName),
		PagePath:    strings.TrimSpace(p.PagePath),
		PageTitle:   strings.TrimSpace(p.PageTitle),
		Referrer:    strings.TrimSpace(p.Referrer),
		Country:     strings.TrimSpace(p.Country),
		City:        strings.TrimSpace(p.City),
		Device:      strings.TrimSpace(p.Device),
		Browser:     strings.TrimSpace(p.Browser),
		OS:          strings.TrimSpace(p.OS),
		UTMSource:   strings.TrimSpace(p.UTMSource),
		UTMMedium:   strings.TrimSpace(p.UTMMedium),
		UTMCampaign: strings.TrimSpace(p.UTMCampaign),
		UTMTerm:     strings.TrimSpace(p.UTMTerm),
		UTMContent:  strings.TrimSpace(p.UTMContent),
	}
	if len(p.Metadata) > 0 {
		event.Metadata = make(map[string]string, len(p.Metadata))
		for k, v := range p.Metadata {
			event.Metadata[k] = v
		}
	}
	if p.OccurredAt != "" {
		if ts, err := time.Parse(time.RFC3339, p.OccurredAt); err == nil {
			event.OccurredAt = ts
		}
	}
	return event
}

func (s *Server) computeServiceMetrics() map[uint]serviceMetrics {
	orders := s.Store.ListOrders()
	metrics := make(map[uint]serviceMetrics, len(orders))
	for _, order := range orders {
		m := metrics[order.ServiceID]
		if order.Status == "done" {
			m.completedCount++
		}
		if order.RatingValue > 0 {
			m.ratingSum += order.RatingValue
			m.ratingCount++
		}
		metrics[order.ServiceID] = m
	}
	return metrics
}

func averageRating(sum, count int) float64 {
	if count == 0 {
		return 0
	}
	return math.Round((float64(sum)/float64(count))*10) / 10
}

func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

func containsString(list []string, target string) bool {
	for _, item := range list {
		if strings.EqualFold(strings.TrimSpace(item), strings.TrimSpace(target)) {
			return true
		}
	}
	return false
}

func isValidBankCode(code string) bool {
	return containsString(xenditBankTransferCodes, code)
}

func isValidEWalletChannel(code string) bool {
	return containsString(xenditEWalletChannelCodes, code)
}

func isValidRetailOutlet(name string) bool {
	return containsString(xenditRetailOutletNames, name)
}

func isValidPayLaterChannel(code string) bool {
	return containsString(xenditPayLaterChannelCodes, code)
}

func isValidCardBrand(code string) bool {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "VISA", "MASTERCARD", "AMEX", "JCB":
		return true
	default:
		return false
	}
}

func New(store *storage.Store, userRepo repository.UserRepository, sessionRepo repository.SessionRepository, uploadDir string) *Server {
	if uploadDir == "" {
		uploadDir = filepath.Join("storage", "uploads")
	}

	frontendBase := trimTrailingSlashes(envString("FRONTEND_BASE_URL", defaultFrontendBaseURL))
	if frontendBase == "" {
		frontendBase = defaultFrontendBaseURL
	}
	backendBase := trimTrailingSlashes(envString("APP_BASE_URL", envString("BACKEND_BASE_URL", defaultBackendBaseURL)))
	if backendBase == "" {
		backendBase = defaultBackendBaseURL
	}

	accessSecret := envString("JWT_ACCESS_SECRET", envString("JWT_SECRET", "change-me-secret"))
	refreshSecret := envString("JWT_REFRESH_SECRET", envString("JWT_SECRET", "change-me-secret"))

	sessionTTL := envDurationMinutes("JWT_EXPIRE_MINUTES", 6*time.Hour)
	if sessionTTL <= 0 {
		sessionTTL = 6 * time.Hour
	}
	accessTTL := envDurationMinutes("JWT_ACCESS_MINUTES", 15*time.Minute)
	if accessTTL <= 0 {
		accessTTL = 15 * time.Minute
	}
	refreshTTL := envDurationMinutes("JWT_REFRESH_MINUTES", 7*24*time.Hour)
	if refreshTTL <= 0 {
		refreshTTL = 7 * 24 * time.Hour
	}
	sessionName := envString("SESSION_COOKIE_NAME", defaultSessionCookieName)
	sessionDomain := strings.TrimSpace(os.Getenv("SESSION_COOKIE_DOMAIN"))
	sessionSecure := envBool("SESSION_COOKIE_SECURE", strings.HasPrefix(frontendBase, "https://") || strings.HasPrefix(backendBase, "https://"))
	cookieSameSite := pickCookieSameSite(parseSameSite(os.Getenv("SESSION_COOKIE_SAMESITE")), sessionSecure)
	userRedirect := normalizeRedirectPath(envString("USER_DASHBOARD_PATH", defaultUserRedirectPath))
	allowedOrigins, allowAll := parseAllowedOrigins(os.Getenv("CORS_ORIGINS"))

	stateSecret := []byte(envString("GOOGLE_STATE_SECRET", os.Getenv("JWT_SECRET")))
	if len(stateSecret) == 0 {
		stateSecret = []byte("google-oauth-state")
	}

	srv := &Server{
		Store:                 store,
		UploadDir:             uploadDir,
		userRepo:              userRepo,
		sessionRepo:           sessionRepo,
		frontendBaseURL:       frontendBase,
		backendBaseURL:        backendBase,
		defaultUserRedirect:   userRedirect,
		sessionTTL:            sessionTTL,
		sessionCookieName:     sessionName,
		sessionCookieDomain:   sessionDomain,
		sessionCookieSecure:   sessionSecure,
		sessionCookieSameSite: cookieSameSite,
		allowedOrigins:        allowedOrigins,
		allowAllOrigins:       allowAll,
		allowCredentials:      true,
		googleStateSecret:     stateSecret,
		accessTokenSecret:     accessSecret,
		refreshTokenSecret:    refreshSecret,
		accessTokenTTL:        accessTTL,
		refreshTokenTTL:       refreshTTL,
		localSessions:         make(map[string]*models.Session),
	}

	srv.httpClient = &http.Client{Timeout: 15 * time.Second}
	apiKey := strings.TrimSpace(os.Getenv("XENDIT_API_KEY"))
	if apiKey == "" {
		apiKey = "xnd_development_ZnCIrKfDBFZwYMYXAf8DP5VAeqQX1kGepY1tKIrNCMalQF60bEkhwGwD53I9qc"
		log.Println("warning: XENDIT_API_KEY not set; using default development key")
	}
	srv.xenditAPIKey = apiKey
	baseURL := strings.TrimSpace(os.Getenv("XENDIT_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://api.xendit.co"
	}
	srv.xenditBaseURL = strings.TrimRight(baseURL, "/")
	srv.xenditCallbackToken = strings.TrimSpace(os.Getenv("XENDIT_CALLBACK_TOKEN"))
	redirectURL := strings.TrimSpace(os.Getenv("XENDIT_REDIRECT_URL"))
	if redirectURL == "" {
		redirectURL = "https://devaracreative.com"
	}
	srv.xenditRedirectURL = strings.TrimRight(redirectURL, "/")

	clientID := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
	googleRedirectURL := envString("GOOGLE_REDIRECT_URL", backendBase+"/api/auth/google/callback")

	if clientID != "" && clientSecret != "" {
		srv.googleOAuthConfig = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  googleRedirectURL,
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			},
			Endpoint: google.Endpoint,
		}
	} else {
		log.Println("google oauth is not fully configured; GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing")
	}

	syncInterval := envDurationMinutes("PAYMENT_SYNC_INTERVAL_MINUTES", time.Minute)
	if syncInterval <= 0 {
		syncInterval = time.Minute
	}
	srv.paymentSyncInterval = syncInterval
	srv.startPaymentSyncLoop()

	return srv
}

func (s *Server) startPaymentSyncLoop() {
	interval := s.paymentSyncInterval
	if interval <= 0 {
		interval = time.Minute
	}
	go func() {
		if _, err := s.syncPayments(context.Background()); err != nil {
			log.Printf("automatic payment sync failed: %v", err)
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			if _, err := s.syncPayments(context.Background()); err != nil {
				log.Printf("automatic payment sync failed: %v", err)
			}
		}
	}()
}

func (s *Server) syncPayments(ctx context.Context) ([]models.Order, error) {
	if s.Store == nil {
		return nil, nil
	}
	updated, err := s.Store.SyncOrderPaymentStatuses(time.Now().UTC())
	if err != nil {
		return nil, err
	}
	if len(updated) > 0 {
		for _, order := range updated {
			log.Printf("payment sync: order %d status=%s payment_status=%s", order.ID, order.Status, order.PaymentStatus)
		}
	}
	return updated, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/api/healthz", http.HandlerFunc(s.handleHealth))
	mux.Handle("/api/services", s.wrapCORS(http.HandlerFunc(s.handleServices)))
	mux.Handle("/api/services/", s.wrapCORS(http.HandlerFunc(s.handleServiceBySlug)))
	mux.Handle("/api/gallery", s.wrapCORS(http.HandlerFunc(s.handleGallery)))
	mux.Handle("/api/experiences", s.wrapCORS(http.HandlerFunc(s.handleExperiences)))
	mux.Handle("/api/categories", s.wrapCORS(http.HandlerFunc(s.handleCategories)))
	mux.Handle("/api/xendit/webhook", http.HandlerFunc(s.handleXenditWebhook))
	mux.Handle("/api/orders", s.wrapCORS(http.HandlerFunc(s.handleOrders)))
	mux.Handle("/api/orders/", s.wrapCORS(http.HandlerFunc(s.handleOrderRoutes)))
	mux.Handle("/api/promocode/validate", s.wrapCORS(http.HandlerFunc(s.handlePromoValidate)))
	mux.Handle("/api/contact", s.wrapCORS(http.HandlerFunc(s.handleContact)))
	mux.Handle("/api/analytics/events", s.wrapCORS(http.HandlerFunc(s.handleAnalyticsEvent)))
	mux.Handle("/api/auth/login", s.wrapCORS(http.HandlerFunc(s.handleLogin)))
	mux.Handle("/api/auth/register", s.wrapCORS(http.HandlerFunc(s.handleUserRegister)))
	mux.Handle("/api/auth/user/login", s.wrapCORS(http.HandlerFunc(s.handleUserLogin)))
	mux.Handle("/api/auth/refresh", s.wrapCORS(http.HandlerFunc(s.handleRefresh)))
	mux.Handle("/api/auth/google/login", http.HandlerFunc(s.handleGoogleLogin))
	mux.Handle("/api/auth/google/callback", http.HandlerFunc(s.handleGoogleCallback))
	mux.Handle("/api/auth/session", s.wrapCORS(http.HandlerFunc(s.handleAuthSession)))
	mux.Handle("/api/auth/logout", s.wrapCORS(http.HandlerFunc(s.handleLogout)))
	mux.Handle("/api/account/providers", s.wrapCORS(http.HandlerFunc(s.handleListProviders)))
	mux.Handle("/api/account/providers/google/link", s.wrapCORS(http.HandlerFunc(s.handleLinkGoogleAccount)))
	mux.Handle("/api/account/providers/google/unlink", s.wrapCORS(http.HandlerFunc(s.handleUnlinkGoogleAccount)))
	mux.Handle("/api/admin/services", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminServices))))
	mux.Handle("/api/admin/services/", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminServiceByID))))
	mux.Handle("/api/admin/gallery", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminGallery))))
	mux.Handle("/api/admin/gallery/", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminGalleryByID))))
	mux.Handle("/api/admin/experiences", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminExperiences))))
	mux.Handle("/api/admin/experiences/", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminExperienceByID))))
	mux.Handle("/api/admin/categories", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminCategories))))
	mux.Handle("/api/admin/categories/", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminCategoryByID))))
	mux.Handle("/api/admin/orders", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminOrders))))
	mux.Handle("/api/admin/orders/", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminOrderActions))))
	mux.Handle("/api/admin/messages", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminMessages))))
	mux.Handle("/api/admin/promocodes", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminPromoCodes))))
	mux.Handle("/api/admin/promocodes/", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminPromoCodeByID))))
	mux.Handle("/api/admin/stats", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminStats))))
	mux.Handle("/api/admin/analytics/summary", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminAnalyticsSummary))))
	mux.Handle("/api/admin/analytics/events", s.wrapCORS(s.requireAdmin(http.HandlerFunc(s.handleAdminAnalyticsEvents))))
	if paymentRouter := s.newPaymentRouter(); paymentRouter != nil {
		mux.Handle("/api/payments/", s.wrapCORS(paymentRouter))
	}
	staticFS := http.FileServer(http.Dir(s.UploadDir))
	mux.Handle("/api/static/", http.StripPrefix("/api/static/", staticFS))
	return mux
}

func (s *Server) newPaymentRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/payments/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			s.methodNotAllowed(w, r)
			return
		}
		s.handlePaymentSync(w, r)
	})
	mux.HandleFunc("/api/payments/status", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			s.methodNotAllowed(w, r)
			return
		}
		s.handlePaymentStatus(w, r)
	})
	mux.Handle("/api/payments/orders/", s.paymentAccessMiddleware(http.HandlerFunc(s.handlePaymentAccessStatus)))
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "time": time.Now().UTC().Format(time.RFC3339)})
}

func (s *Server) handlePaymentSync(w http.ResponseWriter, r *http.Request) {
	updated, err := s.syncPayments(r.Context())
	if err != nil {
		log.Printf("manual payment sync failed: %v", err)
		s.writeErrorMsg(w, http.StatusInternalServerError, "failed to synchronize payments")
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"updated_orders": updated, "count": len(updated)})
}

func (s *Server) handlePaymentStatus(w http.ResponseWriter, r *http.Request) {
	statuses := []models.PaymentChannelStatus{}
	if s.Store != nil {
		statuses = s.Store.ListPaymentChannelStatuses()
	}
	response := map[string]any{
		"statuses":     statuses,
		"generated_at": time.Now().UTC(),
	}
	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) handlePaymentAccessStatus(w http.ResponseWriter, r *http.Request) {
	order, ok := orderFromRequest(r)
	if !ok || order == nil {
		s.writeErrorMsg(w, http.StatusInternalServerError, "order context missing")
		return
	}
	response := map[string]any{"order": order}
	if tx, ok := paymentFromRequest(r); ok && tx != nil {
		response["latest_transaction"] = tx
	}
	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) paymentAccessMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		orderIDParam, ok := extractPaymentOrderID(r.URL.Path)
		if !ok {
			s.notFound(w)
			return
		}
		if r.Method != http.MethodGet {
			s.methodNotAllowed(w, r)
			return
		}
		if _, err := s.syncPayments(r.Context()); err != nil {
			log.Printf("payment sync error: %v", err)
		}
		idValue, err := strconv.ParseUint(orderIDParam, 10, 64)
		if err != nil || idValue == 0 {
			s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
			return
		}
		order, ok := s.Store.GetOrderByID(uint(idValue))
		if !ok {
			s.writeErrorMsg(w, http.StatusNotFound, "order not found")
			return
		}
		latestTx, _ := s.Store.GetLatestPaymentTransactionByOrder(order.ID)
		if latestTx != nil && strings.EqualFold(latestTx.Method, "xendit_invoice") {
			if updatedTx, updatedOrder, err := s.syncInvoiceStatus(r.Context(), latestTx); err == nil {
				if updatedTx != nil {
					latestTx = updatedTx
				}
				if updatedOrder != nil {
					order = updatedOrder
				}
			} else {
				log.Printf("failed to sync invoice status for order %d: %v", order.ID, err)
			}
		}
		allowed, reason := paymentAccessState(order, latestTx)
		if !allowed {
			if reason == "" {
				reason = "Payment session is no longer available for this order"
			}
			s.writeErrorMsg(w, http.StatusForbidden, reason)
			return
		}
		ctx := context.WithValue(r.Context(), contextKeyOrder, order)
		if latestTx != nil {
			ctx = context.WithValue(ctx, contextKeyPayment, latestTx)
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func extractPaymentOrderID(path string) (string, bool) {
	const prefix = "/api/payments/orders/"
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}
	remainder := strings.TrimPrefix(path, prefix)
	parts := strings.SplitN(remainder, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] != "access" {
		return "", false
	}
	return parts[0], true
}

func orderFromRequest(r *http.Request) (*models.Order, bool) {
	order, ok := r.Context().Value(contextKeyOrder).(*models.Order)
	if !ok || order == nil {
		return nil, false
	}
	return order, true
}

func paymentFromRequest(r *http.Request) (*models.PaymentTransaction, bool) {
	payment, ok := r.Context().Value(contextKeyPayment).(*models.PaymentTransaction)
	if !ok || payment == nil {
		return nil, false
	}
	return payment, true
}

func (s *Server) handleServices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	services := s.Store.ListServices()
	categories := s.Store.ListCategories()
	catMap := make(map[uint]models.Category, len(categories))
	for _, c := range categories {
		catMap[c.ID] = c
	}
	metrics := s.computeServiceMetrics()
	filter := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("category")))
	if filter != "" {
		filtered := services[:0]
		for _, svc := range services {
			if cat, ok := catMap[svc.CategoryID]; ok {
				if cat.Slug == filter || strings.ToLower(cat.Name) == filter {
					filtered = append(filtered, svc)
				}
			}
		}
		services = filtered
	}
	type serviceResponse struct {
		models.Service
		Category       string  `json:"category"`
		CategorySlug   string  `json:"category_slug"`
		AverageRating  float64 `json:"average_rating"`
		RatingCount    int     `json:"rating_count"`
		CompletedCount int     `json:"completed_count"`
	}
	var out []serviceResponse
	for _, svc := range services {
		categoryName := ""
		categorySlug := ""
		if cat, ok := catMap[svc.CategoryID]; ok {
			categoryName = cat.Name
			categorySlug = cat.Slug
		}
		m := metrics[svc.ID]
		out = append(out, serviceResponse{
			Service:        svc,
			Category:       categoryName,
			CategorySlug:   categorySlug,
			AverageRating:  averageRating(m.ratingSum, m.ratingCount),
			RatingCount:    m.ratingCount,
			CompletedCount: m.completedCount,
		})
	}
	s.writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleGallery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	allItems := s.Store.ListGalleryItems("")
	section := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("section")))
	items := make([]models.GalleryItem, 0, len(allItems))
	if section == "" {
		items = allItems
	} else {
		for _, item := range allItems {
			if strings.TrimSpace(strings.ToLower(item.Section)) == section {
				items = append(items, item)
			}
		}
	}
	filters := buildGalleryFilters(allItems)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"items":   items,
		"filters": filters,
	})
}

func (s *Server) handleExperiences(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	experiences := s.Store.ListExperiences()
	s.writeJSON(w, http.StatusOK, experiences)
}

func (s *Server) handleServiceBySlug(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	slug := strings.TrimPrefix(r.URL.Path, "/api/services/")
	if slug == "" {
		s.notFound(w)
		return
	}
	svc, ok := s.Store.GetServiceBySlug(slug)
	if !ok {
		s.notFound(w)
		return
	}
	category, _ := s.Store.GetCategoryByID(svc.CategoryID)
	metrics := s.computeServiceMetrics()
	m := metrics[svc.ID]
	response := struct {
		*models.Service
		Category       *models.Category `json:"category,omitempty"`
		AverageRating  float64          `json:"average_rating"`
		RatingCount    int              `json:"rating_count"`
		CompletedCount int              `json:"completed_count"`
	}{
		Service:        svc,
		Category:       category,
		AverageRating:  averageRating(m.ratingSum, m.ratingCount),
		RatingCount:    m.ratingCount,
		CompletedCount: m.completedCount,
	}
	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	s.writeJSON(w, http.StatusOK, s.Store.ListCategories())
}

func (s *Server) handleOrders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		orders := s.Store.ListOrders()
		services := s.Store.ListServices()
		svcMap := make(map[uint]string)
		for _, svc := range services {
			svcMap[svc.ID] = svc.Title
		}
		type orderResponse struct {
			models.Order
			Service string `json:"service"`
		}
		var out []orderResponse
		for _, o := range orders {
			out = append(out, orderResponse{
				Order:   o,
				Service: svcMap[o.ServiceID],
			})
		}
		s.writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var payload struct {
			ServiceSlug     string `json:"service_slug"`
			Name            string `json:"customer_name"`
			Email           string `json:"customer_email"`
			Phone           string `json:"customer_phone"`
			Notes           string `json:"notes"`
			PromoCode       string `json:"promo_code"`
			PaymentCategory string `json:"payment_category"`
			PaymentChannel  string `json:"payment_channel"`
			CardTokenID     string `json:"card_token_id"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		payload.ServiceSlug = strings.TrimSpace(payload.ServiceSlug)
		payload.Name = strings.TrimSpace(payload.Name)
		payload.Email = strings.TrimSpace(payload.Email)
		payload.Phone = strings.TrimSpace(payload.Phone)
		payload.Notes = strings.TrimSpace(payload.Notes)
		payload.PromoCode = strings.TrimSpace(payload.PromoCode)
		payload.PaymentCategory = strings.TrimSpace(payload.PaymentCategory)
		payload.PaymentChannel = strings.TrimSpace(payload.PaymentChannel)
		payload.CardTokenID = strings.TrimSpace(payload.CardTokenID)
		if payload.ServiceSlug == "" || payload.Name == "" || payload.Email == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "service slug, name and email are required")
			return
		}
		if payload.PaymentCategory == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "payment category is required")
			return
		}
		svc, ok := s.Store.GetServiceBySlug(payload.ServiceSlug)
		if !ok {
			s.writeErrorMsg(w, http.StatusNotFound, "Service not found")
			return
		}
		normalizedCategory := strings.ToUpper(payload.PaymentCategory)
		normalizedChannel := strings.ToUpper(payload.PaymentChannel)
		if normalizedCategory != "QRIS" && normalizedCategory != "CARD" && normalizedChannel == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "payment channel is required for selected category")
			return
		}
		switch normalizedCategory {
		case "QRIS":
		case "VIRTUAL_ACCOUNT":
			if !isValidBankCode(normalizedChannel) {
				s.writeErrorMsg(w, http.StatusBadRequest, "invalid virtual account bank code")
				return
			}
		case "EWALLET":
			if !isValidEWalletChannel(normalizedChannel) {
				s.writeErrorMsg(w, http.StatusBadRequest, "invalid e-wallet channel")
				return
			}
		case "RETAIL_OUTLET":
			if !isValidRetailOutlet(normalizedChannel) {
				s.writeErrorMsg(w, http.StatusBadRequest, "invalid retail outlet channel")
				return
			}
		case "PAYLATER":
			if !isValidPayLaterChannel(normalizedChannel) {
				s.writeErrorMsg(w, http.StatusBadRequest, "invalid paylater channel")
				return
			}
		case "CARD":
			if normalizedChannel == "" {
				normalizedChannel = "CARD"
			}
			if normalizedChannel != "CARD" && !isValidCardBrand(normalizedChannel) {
				s.writeErrorMsg(w, http.StatusBadRequest, "unsupported card brand")
				return
			}
		default:
			s.writeErrorMsg(w, http.StatusBadRequest, "unsupported payment category")
			return
		}
		order := &models.Order{
			ServiceID:     svc.ID,
			CustomerName:  payload.Name,
			CustomerEmail: payload.Email,
			CustomerPhone: payload.Phone,
			Notes:         payload.Notes,
			Amount:        svc.Price,
			PromoCode:     payload.PromoCode,
			Status:        "pending",
		}
		created, err := s.Store.CreateOrder(order)
		if err != nil {
			status := http.StatusInternalServerError
			msg := err.Error()
			switch {
			case errors.Is(err, storage.ErrPromoNotFound):
				status = http.StatusNotFound
				msg = "promo code not found"
			case errors.Is(err, storage.ErrPromoInactive):
				status = http.StatusBadRequest
				msg = "promo code inactive"
			case errors.Is(err, storage.ErrPromoNotStarted):
				status = http.StatusBadRequest
				msg = "promo code not yet valid"
			case errors.Is(err, storage.ErrPromoExpired):
				status = http.StatusBadRequest
				msg = "promo code expired"
			case errors.Is(err, storage.ErrPromoUsageExceeded):
				status = http.StatusBadRequest
				msg = "promo code usage limit reached"
			}
			s.writeErrorMsg(w, status, msg)
			return
		}

		paymentReq := paymentRequest{
			Category:  normalizedCategory,
			Channel:   normalizedChannel,
			CardToken: payload.CardTokenID,
		}
		tx, updatedOrder, err := s.createPaymentForOrder(r.Context(), created, paymentReq)
		if err != nil {
			log.Printf("failed to create payment for order %d: %v", created.ID, err)
			if deleteErr := s.Store.DeleteOrder(created.ID); deleteErr != nil {
				log.Printf("failed to rollback order %d after payment error: %v", created.ID, deleteErr)
			}
			status := http.StatusBadGateway
			msg := "failed to create payment request"
			if errors.Is(err, errPaymentWindowClosed) {
				status = http.StatusForbidden
				msg = "payment session is no longer available for this order"
				if allowed, reason := paymentAccessState(created, tx); !allowed && reason != "" {
					msg = reason
				}
			}
			s.writeErrorMsg(w, status, msg)
			return
		}
		if updatedOrder != nil {
			created = updatedOrder
		}
		response := map[string]any{
			"order": created,
		}
		if paymentURL := s.paymentPageURL(created.ID); paymentURL != "" {
			response["payment_page_url"] = paymentURL
		}
		if tx != nil {
			response["transaction"] = tx
			if tx.InvoiceURL != "" {
				response["invoice_url"] = tx.InvoiceURL
			}
			if tx.CheckoutURL != "" {
				response["checkout_url"] = tx.CheckoutURL
			}
			if tx.QRCodeURL != "" {
				response["qr_code_url"] = tx.QRCodeURL
			}
			if tx.VirtualAccountNumber != "" {
				response["virtual_account_number"] = tx.VirtualAccountNumber
			}
			if tx.PaymentCode != "" {
				response["payment_code"] = tx.PaymentCode
			}
		}
		s.writeJSON(w, http.StatusCreated, response)
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) createInvoiceForOrder(ctx context.Context, order *models.Order) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	if strings.TrimSpace(s.xenditAPIKey) == "" {
		return nil, nil, errors.New("xendit api key not configured")
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	invoiceAmount := int64(math.Round(amount))
	if invoiceAmount <= 0 {
		invoiceAmount = 1
	}
	reference := fmt.Sprintf("ORDER-%d", order.ID)
	externalID := fmt.Sprintf("order-%d-invoice-%d", order.ID, time.Now().UnixNano())
	serviceTitle := ""
	if svc, ok := s.Store.GetServiceByID(order.ServiceID); ok {
		serviceTitle = svc.Title
	}
	description := fmt.Sprintf("Pembayaran Order #%d", order.ID)
	if strings.TrimSpace(serviceTitle) != "" {
		description = fmt.Sprintf("Pembayaran Order #%d • %s", order.ID, serviceTitle)
	}
	successRedirect := s.invoiceRedirectURL(order.ID, "success")
	failureRedirect := s.invoiceRedirectURL(order.ID, "failed")
	baseRedirect := s.invoiceRedirectURL(order.ID, "")
	payload := map[string]any{
		"external_id":          externalID,
		"amount":               invoiceAmount,
		"description":          description,
		"currency":             "IDR",
		"success_redirect_url": successRedirect,
		"failure_redirect_url": failureRedirect,
		"redirect_url":         baseRedirect,
		"payment_methods":      []string{"CARD", "BANK_TRANSFER", "RETAIL_OUTLET", "EWALLET", "QR_CODE", "PAYLATER"},
		"available_payments":   s.defaultAvailablePayments(),
		"invoice_duration":     24 * 60 * 60,
		"metadata": map[string]any{
			"order_id":       order.ID,
			"customer_email": order.CustomerEmail,
			"customer_name":  order.CustomerName,
			"customer_phone": order.CustomerPhone,
			"payment_source": "xendit_invoice",
		},
	}
	customer := map[string]any{}
	if strings.TrimSpace(order.CustomerName) != "" {
		customer["given_names"] = order.CustomerName
	}
	if strings.TrimSpace(order.CustomerEmail) != "" {
		customer["email"] = order.CustomerEmail
	}
	if strings.TrimSpace(order.CustomerPhone) != "" {
		customer["mobile_number"] = order.CustomerPhone
	}
	if len(customer) > 0 {
		payload["customer"] = customer
	}
	items := []map[string]any{
		{
			"name":         serviceTitle,
			"quantity":     1,
			"price":        invoiceAmount,
			"reference_id": reference,
		},
	}
	payload["items"] = items
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/v2/invoices", body)
	if err != nil {
		return nil, nil, err
	}
	if statusCode >= 300 {
		return nil, nil, fmt.Errorf("xendit invoice creation failed: status %d", statusCode)
	}
	var invoiceData map[string]any
	if err := json.Unmarshal(respBody, &invoiceData); err != nil {
		return nil, nil, err
	}
	if ext := stringFromAny(invoiceData["external_id"]); ext != "" {
		externalID = ext
	}
	invoiceID := stringFromAny(invoiceData["id"])
	if invoiceID == "" {
		return nil, nil, errors.New("missing invoice id from xendit response")
	}
	invoiceURL := stringFromAny(invoiceData["invoice_url"])
	status := strings.ToUpper(stringFromAny(invoiceData["status"]))
	if status == "" {
		status = "PENDING"
	}
	channel := strings.ToLower(strings.TrimSpace(stringFromAny(invoiceData["payment_method"])))
	if channel == "" {
		channel = strings.ToLower(strings.TrimSpace(stringFromAny(invoiceData["payment_channel"])))
	}
	currency := stringFromAny(invoiceData["currency"])
	if currency == "" {
		currency = "IDR"
	}
	if ref := stringFromAny(invoiceData["merchant_reference"]); ref != "" {
		reference = ref
	}
	if amountValue, ok := floatFromAny(invoiceData["amount"]); ok {
		amount = amountValue
	}
	expiresAt, hasExpiry := timeFromPayload(invoiceData, "expiry_date", "expiry_at", "expires_at")
	tx := &models.PaymentTransaction{
		OrderID:     order.ID,
		Method:      "xendit_invoice",
		Channel:     channel,
		Status:      status,
		Amount:      amount,
		Currency:    currency,
		Reference:   reference,
		ExternalID:  externalID,
		XenditID:    invoiceID,
		InvoiceURL:  invoiceURL,
		RawResponse: respBody,
	}
	if hasExpiry {
		tx.ExpiresAt = expiresAt
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	return storedTx, updatedOrder, nil
}

func (s *Server) defaultAvailablePayments() []map[string]any {
	payments := make([]map[string]any, 0, len(xenditBankTransferCodes)+len(xenditEWalletChannelCodes)+len(xenditRetailOutletNames)+len(xenditPayLaterChannelCodes)+2)
	for _, bank := range xenditBankTransferCodes {
		payments = append(payments, map[string]any{
			"type":      "BANK_TRANSFER",
			"bank_code": bank,
		})
	}
	for _, code := range xenditEWalletChannelCodes {
		payments = append(payments, map[string]any{
			"type":                 "EWALLET",
			"ewallet_channel_code": code,
		})
	}
	for _, name := range xenditRetailOutletNames {
		payments = append(payments, map[string]any{
			"type":               "RETAIL_OUTLET",
			"retail_outlet_name": name,
		})
	}
	payments = append(payments, map[string]any{
		"type":                 "QR_CODE",
		"qr_code_channel_code": "QRIS",
	})
	for _, code := range xenditPayLaterChannelCodes {
		payments = append(payments, map[string]any{
			"type":                  "PAYLATER",
			"paylater_channel_code": code,
		})
	}
	payments = append(payments, map[string]any{"type": "CARD"})
	return payments
}

func (s *Server) invoiceRedirectURL(orderID uint, status string) string {
	base := strings.TrimSpace(s.xenditRedirectURL)
	if base == "" {
		base = strings.TrimSpace(s.frontendBaseURL)
	}
	if base == "" {
		return ""
	}
	params := url.Values{}
	if orderID > 0 {
		params.Set("order_id", fmt.Sprintf("%d", orderID))
	}
	if strings.TrimSpace(status) != "" {
		params.Set("status", strings.TrimSpace(status))
	}
	if len(params) == 0 {
		return base
	}
	separator := "?"
	if strings.Contains(base, "?") {
		separator = "&"
	}
	return base + separator + params.Encode()
}

func (s *Server) paymentPageURL(orderID uint) string {
	base := strings.TrimSpace(s.frontendBaseURL)
	if base == "" {
		return ""
	}
	return strings.TrimRight(base, "/") + fmt.Sprintf("/checkout/payment/%d", orderID)
}

func (s *Server) xenditCallbackURL() string {
	base := strings.TrimSpace(s.backendBaseURL)
	if base == "" {
		return ""
	}
	return strings.TrimRight(base, "/") + "/api/xendit/webhook"
}

func (s *Server) paymentMetadata(order *models.Order) map[string]any {
	if order == nil {
		return map[string]any{}
	}
	metadata := map[string]any{
		"order_id":       order.ID,
		"customer_email": order.CustomerEmail,
		"customer_name":  order.CustomerName,
		"customer_phone": order.CustomerPhone,
	}
	return metadata
}

func (s *Server) createPaymentForOrder(ctx context.Context, order *models.Order, req paymentRequest) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	if strings.TrimSpace(s.xenditAPIKey) == "" {
		return nil, nil, errors.New("xendit api key not configured")
	}
	latestTx, _ := s.Store.GetLatestPaymentTransactionByOrder(order.ID)
	if isOrderPaymentWindowClosed(order, latestTx) {
		return nil, nil, errPaymentWindowClosed
	}
	category := strings.ToUpper(strings.TrimSpace(req.Category))
	channel := strings.ToUpper(strings.TrimSpace(req.Channel))
	if canReusePaymentTransaction(order, latestTx, category, channel) {
		return latestTx, order, nil
	}
	switch category {
	case "QRIS":
		return s.createQRISPayment(ctx, order)
	case "VIRTUAL_ACCOUNT":
		return s.createVirtualAccountPayment(ctx, order, channel)
	case "EWALLET":
		return s.createEWalletCharge(ctx, order, channel)
	case "RETAIL_OUTLET":
		return s.createRetailOutletPayment(ctx, order, channel)
	case "PAYLATER":
		return s.createPayLaterCharge(ctx, order, channel)
	case "CARD":
		return s.createCardPayment(ctx, order, channel, req.CardToken)
	default:
		return nil, nil, fmt.Errorf("unsupported payment category: %s", category)
	}
}

func (s *Server) createQRISPayment(ctx context.Context, order *models.Order) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	amountInt := int64(math.Round(amount))
	if amountInt <= 0 {
		amountInt = 1
	}
	externalID := fmt.Sprintf("order-%d-qris-%d", order.ID, time.Now().UnixNano())
	payload := map[string]any{
		"external_id": externalID,
		"type":        "DYNAMIC",
		"amount":      amountInt,
		"currency":    "IDR",
		"metadata":    s.paymentMetadata(order),
	}
	if desc := fmt.Sprintf("Pembayaran Order #%d", order.ID); desc != "" {
		payload["description"] = desc
	}
	if cb := s.xenditCallbackURL(); cb != "" {
		payload["callback_url"] = cb
	}
	if redirect := s.invoiceRedirectURL(order.ID, "success"); redirect != "" {
		payload["success_redirect_url"] = redirect
	}
	if redirect := s.invoiceRedirectURL(order.ID, "failed"); redirect != "" {
		payload["failure_redirect_url"] = redirect
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/qr_codes", body)
	if err != nil {
		return nil, nil, s.handleXenditCallError("QRIS", "QRIS", "failed to create QRIS payment", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("QRIS", "QRIS", "failed to create QRIS payment", statusCode, respBody, nil)
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, nil, err
	}
	xenditID := stringFromAny(data["id"])
	if xenditID == "" {
		xenditID = stringFromAny(data["qr_code"])
	}
	if xenditID == "" {
		return nil, nil, errors.New("missing qris id from xendit response")
	}
	status := strings.ToUpper(stringFromAny(data["status"]))
	if status == "" {
		status = "PENDING"
	}
	var expires time.Time
	if expiry, ok := timeFromPayload(data, "expires_at", "expiry_date"); ok {
		expires = expiry
	}
	tx := &models.PaymentTransaction{
		OrderID:     order.ID,
		Method:      "QRIS",
		Channel:     "QRIS",
		Status:      status,
		Amount:      amount,
		Currency:    "IDR",
		Reference:   fmt.Sprintf("ORDER-%d", order.ID),
		ExternalID:  externalID,
		XenditID:    xenditID,
		QRCodeURL:   stringFromAny(data["qr_code_url"]),
		QRString:    stringFromAny(data["qr_string"]),
		ExpiresAt:   expires,
		RawResponse: json.RawMessage(respBody),
	}
	if tx.QRCodeURL == "" {
		tx.QRCodeURL = stringFromAny(data["qr_code"])
	}
	if tx.QRCodeURL == "" {
		tx.QRCodeURL = stringFromAny(data["qr_image"])
	}
	if checkout := stringFromAny(data["checkout_url"]); checkout != "" {
		tx.CheckoutURL = checkout
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	s.recordPaymentChannelAvailability("QRIS", "QRIS", true, "")
	return storedTx, updatedOrder, nil
}

func (s *Server) createVirtualAccountPayment(ctx context.Context, order *models.Order, bankCode string) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	bank := strings.ToUpper(strings.TrimSpace(bankCode))
	if bank == "" {
		return nil, nil, errors.New("bank code is required")
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	amountInt := int64(math.Round(amount))
	if amountInt <= 0 {
		amountInt = 1
	}
	externalID := fmt.Sprintf("order-%d-va-%s-%d", order.ID, strings.ToLower(bank), time.Now().UnixNano())
	name := strings.TrimSpace(order.CustomerName)
	if name == "" {
		name = "Customer"
	}
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	payload := map[string]any{
		"external_id":     externalID,
		"bank_code":       bank,
		"name":            name,
		"expected_amount": amountInt,
		"is_closed":       true,
		"metadata":        s.paymentMetadata(order),
		"expiration_date": expiresAt.Format(time.RFC3339),
	}
	if cb := s.xenditCallbackURL(); cb != "" {
		payload["callback_url"] = cb
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/callback_virtual_accounts", body)
	if err != nil {
		return nil, nil, s.handleXenditCallError("VIRTUAL_ACCOUNT", bank, "failed to create virtual account", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("VIRTUAL_ACCOUNT", bank, "failed to create virtual account", statusCode, respBody, nil)
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, nil, err
	}
	xenditID := stringFromAny(data["id"])
	if xenditID == "" {
		return nil, nil, errors.New("missing virtual account id from xendit response")
	}
	vaNumber := stringFromAny(data["account_number"])
	if vaNumber == "" {
		vaNumber = stringFromAny(data["virtual_account_number"])
	}
	status := strings.ToUpper(stringFromAny(data["status"]))
	if status == "" {
		status = "PENDING"
	}
	if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
		expiresAt = expiry
	}
	tx := &models.PaymentTransaction{
		OrderID:              order.ID,
		Method:               "VIRTUAL_ACCOUNT",
		Channel:              bank,
		Status:               status,
		Amount:               amount,
		Currency:             "IDR",
		Reference:            fmt.Sprintf("ORDER-%d", order.ID),
		ExternalID:           externalID,
		XenditID:             xenditID,
		VirtualAccountNumber: vaNumber,
		BankCode:             bank,
		ExpiresAt:            expiresAt,
		RawResponse:          json.RawMessage(respBody),
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	s.recordPaymentChannelAvailability("VIRTUAL_ACCOUNT", bank, true, "")
	return storedTx, updatedOrder, nil
}

func (s *Server) createEWalletCharge(ctx context.Context, order *models.Order, channel string) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	normalized := strings.ToUpper(strings.TrimSpace(channel))
	if normalized == "" {
		return nil, nil, errors.New("ewallet channel is required")
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	amountInt := int64(math.Round(amount))
	if amountInt <= 0 {
		amountInt = 1
	}
	referenceID := fmt.Sprintf("order-%d-ewallet-%s-%d", order.ID, strings.ToLower(normalized), time.Now().UnixNano())
	channelProps := map[string]any{}
	switch normalized {
	case "OVO":
		phone := strings.TrimSpace(order.CustomerPhone)
		if phone == "" {
			return nil, nil, errors.New("customer phone number is required for OVO payments")
		}
		channelProps["mobile_number"] = phone
	default:
		success := s.invoiceRedirectURL(order.ID, "success")
		failure := s.invoiceRedirectURL(order.ID, "failed")
		if success != "" {
			channelProps["success_redirect_url"] = success
		}
		if failure != "" {
			channelProps["failure_redirect_url"] = failure
		}
	}
	payload := map[string]any{
		"reference_id":    referenceID,
		"currency":        "IDR",
		"amount":          amountInt,
		"channel_code":    normalized,
		"checkout_method": "ONE_TIME",
		"metadata":        s.paymentMetadata(order),
	}
	if len(channelProps) > 0 {
		payload["channel_properties"] = channelProps
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/ewallets/charges", body)
	if err != nil {
		return nil, nil, s.handleXenditCallError("EWALLET", normalized, "failed to create e-wallet charge", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("EWALLET", normalized, "failed to create e-wallet charge", statusCode, respBody, nil)
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, nil, err
	}
	xenditID := stringFromAny(data["id"])
	if xenditID == "" {
		xenditID = stringFromAny(data["charge_id"])
	}
	if xenditID == "" {
		return nil, nil, errors.New("missing e-wallet charge id")
	}
	status := strings.ToUpper(stringFromAny(data["status"]))
	if status == "" {
		status = "PENDING"
	}
	var expires time.Time
	if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
		expires = expiry
	}
	checkoutURL := stringFromAny(data["checkout_url"])
	if actions, ok := data["actions"].(map[string]any); ok {
		if checkoutURL == "" {
			checkoutURL = stringFromAny(actions["desktop_web_checkout_url"])
		}
		if checkoutURL == "" {
			checkoutURL = stringFromAny(actions["mobile_web_checkout_url"])
		}
		if checkoutURL == "" {
			checkoutURL = stringFromAny(actions["mobile_web_app_deeplink"])
		}
	}
	tx := &models.PaymentTransaction{
		OrderID:     order.ID,
		Method:      "EWALLET",
		Channel:     normalized,
		Status:      status,
		Amount:      amount,
		Currency:    "IDR",
		Reference:   fmt.Sprintf("ORDER-%d", order.ID),
		ExternalID:  referenceID,
		XenditID:    xenditID,
		CheckoutURL: checkoutURL,
		ExpiresAt:   expires,
		RawResponse: json.RawMessage(respBody),
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	s.recordPaymentChannelAvailability("EWALLET", normalized, true, "")
	return storedTx, updatedOrder, nil
}

func (s *Server) createRetailOutletPayment(ctx context.Context, order *models.Order, outlet string) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	normalized := strings.ToUpper(strings.TrimSpace(outlet))
	if normalized == "" {
		return nil, nil, errors.New("retail outlet is required")
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	amountInt := int64(math.Round(amount))
	if amountInt <= 0 {
		amountInt = 1
	}
	externalID := fmt.Sprintf("order-%d-retail-%s-%d", order.ID, strings.ToLower(normalized), time.Now().UnixNano())
	customer := strings.TrimSpace(order.CustomerName)
	if customer == "" {
		customer = "Customer"
	}
	expiresAt := time.Now().UTC().Add(48 * time.Hour)
	payload := map[string]any{
		"external_id":        externalID,
		"retail_outlet_name": normalized,
		"name":               customer,
		"expected_amount":    amountInt,
		"metadata":           s.paymentMetadata(order),
		"expiration_date":    expiresAt.Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/retail_outlets", body)
	if err != nil {
		return nil, nil, s.handleXenditCallError("RETAIL_OUTLET", normalized, "failed to create retail outlet payment", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("RETAIL_OUTLET", normalized, "failed to create retail outlet payment", statusCode, respBody, nil)
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, nil, err
	}
	xenditID := stringFromAny(data["id"])
	if xenditID == "" {
		return nil, nil, errors.New("missing retail outlet id")
	}
	status := strings.ToUpper(stringFromAny(data["status"]))
	if status == "" {
		status = "PENDING"
	}
	paymentCode := stringFromAny(data["payment_code"])
	if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
		expiresAt = expiry
	}
	tx := &models.PaymentTransaction{
		OrderID:     order.ID,
		Method:      "RETAIL_OUTLET",
		Channel:     normalized,
		Status:      status,
		Amount:      amount,
		Currency:    "IDR",
		Reference:   fmt.Sprintf("ORDER-%d", order.ID),
		ExternalID:  externalID,
		XenditID:    xenditID,
		PaymentCode: paymentCode,
		ExpiresAt:   expiresAt,
		RawResponse: json.RawMessage(respBody),
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	s.recordPaymentChannelAvailability("RETAIL_OUTLET", normalized, true, "")
	return storedTx, updatedOrder, nil
}

func (s *Server) createPayLaterCharge(ctx context.Context, order *models.Order, channel string) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	normalized := strings.ToUpper(strings.TrimSpace(channel))
	if normalized == "" {
		return nil, nil, errors.New("paylater channel is required")
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	amountInt := int64(math.Round(amount))
	if amountInt <= 0 {
		amountInt = 1
	}
	customerID := fmt.Sprintf("order-%d-customer", order.ID)
	planPayload := map[string]any{
		"customer_id":  customerID,
		"channel_code": normalized,
		"currency":     "IDR",
		"amount":       amountInt,
		"metadata":     s.paymentMetadata(order),
	}
	if email := strings.TrimSpace(order.CustomerEmail); email != "" {
		planPayload["customer_details"] = map[string]any{
			"email": email,
			"name":  order.CustomerName,
			"phone": order.CustomerPhone,
		}
	}
	planBody, err := json.Marshal(planPayload)
	if err != nil {
		return nil, nil, err
	}
	planResp, statusCode, err := s.callXendit(ctx, http.MethodPost, "/paylater/plans", planBody)
	if err != nil {
		return nil, nil, s.handleXenditCallError("PAYLATER", normalized, "failed to fetch paylater plan", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("PAYLATER", normalized, "failed to fetch paylater plan", statusCode, planResp, nil)
	}
	planID := ""
	if err := func() error {
		var planData any
		if err := json.Unmarshal(planResp, &planData); err != nil {
			return err
		}
		switch val := planData.(type) {
		case map[string]any:
			planID = stringFromAny(val["id"])
			if planID == "" {
				if plansRaw, ok := val["plans"]; ok {
					if arr, ok := plansRaw.([]any); ok {
						for _, entry := range arr {
							if m, ok := entry.(map[string]any); ok {
								planID = stringFromAny(m["id"])
								if planID != "" {
									break
								}
							}
						}
					}
				}
			}
		case []any:
			for _, entry := range val {
				if m, ok := entry.(map[string]any); ok {
					planID = stringFromAny(m["id"])
					if planID != "" {
						break
					}
				}
			}
		}
		return nil
	}(); err != nil {
		return nil, nil, err
	}
	if planID == "" {
		return nil, nil, errors.New("failed to determine paylater plan id")
	}
	referenceID := fmt.Sprintf("order-%d-paylater-%s-%d", order.ID, strings.ToLower(normalized), time.Now().UnixNano())
	serviceTitle := "Order"
	if svc, ok := s.Store.GetServiceByID(order.ServiceID); ok {
		serviceTitle = svc.Title
	}
	chargePayload := map[string]any{
		"plan_id":         planID,
		"reference_id":    referenceID,
		"checkout_method": "ONE_TIME",
		"items": []map[string]any{
			{
				"id":       fmt.Sprintf("order-%d", order.ID),
				"name":     serviceTitle,
				"price":    amountInt,
				"quantity": 1,
			},
		},
		"metadata": s.paymentMetadata(order),
	}
	success := s.invoiceRedirectURL(order.ID, "success")
	failure := s.invoiceRedirectURL(order.ID, "failed")
	if success != "" {
		chargePayload["success_redirect_url"] = success
	}
	if failure != "" {
		chargePayload["failure_redirect_url"] = failure
	}
	chargeBody, err := json.Marshal(chargePayload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/paylater/charges", chargeBody)
	if err != nil {
		return nil, nil, s.handleXenditCallError("PAYLATER", normalized, "failed to create paylater charge", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("PAYLATER", normalized, "failed to create paylater charge", statusCode, respBody, nil)
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, nil, err
	}
	xenditID := stringFromAny(data["id"])
	if xenditID == "" {
		xenditID = stringFromAny(data["charge_id"])
	}
	if xenditID == "" {
		return nil, nil, errors.New("missing paylater charge id")
	}
	status := strings.ToUpper(stringFromAny(data["status"]))
	if status == "" {
		status = "PENDING"
	}
	checkoutURL := stringFromAny(data["checkout_url"])
	if actions, ok := data["actions"].(map[string]any); ok {
		if checkoutURL == "" {
			checkoutURL = stringFromAny(actions["mobile_web_checkout_url"])
		}
		if checkoutURL == "" {
			checkoutURL = stringFromAny(actions["desktop_web_checkout_url"])
		}
	}
	var expires time.Time
	if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
		expires = expiry
	}
	tx := &models.PaymentTransaction{
		OrderID:     order.ID,
		Method:      "PAYLATER",
		Channel:     normalized,
		Status:      status,
		Amount:      amount,
		Currency:    "IDR",
		Reference:   fmt.Sprintf("ORDER-%d", order.ID),
		ExternalID:  referenceID,
		XenditID:    xenditID,
		CheckoutURL: checkoutURL,
		ExpiresAt:   expires,
		RawResponse: json.RawMessage(respBody),
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	s.recordPaymentChannelAvailability("PAYLATER", normalized, true, "")
	return storedTx, updatedOrder, nil
}

func (s *Server) createCardPayment(ctx context.Context, order *models.Order, channel, cardToken string) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	if latestTx, _ := s.Store.GetLatestPaymentTransactionByOrder(order.ID); isOrderPaymentWindowClosed(order, latestTx) {
		return nil, nil, errPaymentWindowClosed
	}
	amount := roundCurrency(order.Amount)
	if amount <= 0 {
		return nil, nil, errors.New("order amount must be greater than zero")
	}
	normalized := strings.ToUpper(strings.TrimSpace(channel))
	amountInt := int64(math.Round(amount))
	if amountInt <= 0 {
		amountInt = 1
	}
	trimmedToken := strings.TrimSpace(cardToken)
	externalID := fmt.Sprintf("order-%d-card-%d", order.ID, time.Now().UnixNano())
	if trimmedToken == "" {
		expiresAt := time.Now().UTC().Add(24 * time.Hour)
		tx := &models.PaymentTransaction{
			OrderID:     order.ID,
			Method:      "CARD",
			Channel:     normalized,
			Status:      "REQUIRES_ACTION",
			Amount:      amount,
			Currency:    "IDR",
			Reference:   fmt.Sprintf("ORDER-%d", order.ID),
			ExternalID:  externalID,
			XenditID:    externalID,
			CheckoutURL: s.paymentPageURL(order.ID),
			ExpiresAt:   expiresAt,
		}
		return s.Store.CreatePaymentTransaction(tx)
	}
	payload := map[string]any{
		"token_id":    trimmedToken,
		"external_id": externalID,
		"amount":      amountInt,
		"currency":    "IDR",
		"capture":     true,
		"metadata":    s.paymentMetadata(order),
	}
	if normalized != "" {
		payload["card_brand"] = normalized
	}
	success := s.invoiceRedirectURL(order.ID, "success")
	failure := s.invoiceRedirectURL(order.ID, "failed")
	if success != "" {
		payload["success_redirect_url"] = success
	}
	if failure != "" {
		payload["failure_redirect_url"] = failure
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/credit_card_charges", body)
	if err != nil {
		return nil, nil, s.handleXenditCallError("CARD", normalized, "failed to create card charge", statusCode, nil, err)
	}
	if statusCode >= 300 {
		return nil, nil, s.handleXenditCallError("CARD", normalized, "failed to create card charge", statusCode, respBody, nil)
	}
	var data map[string]any
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, nil, err
	}
	xenditID := stringFromAny(data["id"])
	if xenditID == "" {
		xenditID = stringFromAny(data["credit_card_charge_id"])
	}
	if xenditID == "" {
		xenditID = externalID
	}
	status := strings.ToUpper(stringFromAny(data["status"]))
	if status == "" {
		status = "PENDING"
	}
	checkoutURL := stringFromAny(data["redirect_url"])
	tx := &models.PaymentTransaction{
		OrderID:     order.ID,
		Method:      "CARD",
		Channel:     normalized,
		Status:      status,
		Amount:      amount,
		Currency:    "IDR",
		Reference:   fmt.Sprintf("ORDER-%d", order.ID),
		ExternalID:  externalID,
		XenditID:    xenditID,
		CheckoutURL: checkoutURL,
		RawResponse: json.RawMessage(respBody),
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	s.recordPaymentChannelAvailability("CARD", normalized, true, "")
	return storedTx, updatedOrder, nil
}

func shouldSyncInvoiceStatus(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "", "PENDING", "UNPAID", "NEEDS_ACTION", "AWAITING_PAYMENT":
		return true
	case "PAID", "COMPLETED", "SETTLED", "SUCCESS", "EXPIRED", "CANCELLED", "FAILED":
		return false
	default:
		return true
	}
}

func (s *Server) syncInvoiceStatus(ctx context.Context, tx *models.PaymentTransaction) (*models.PaymentTransaction, *models.Order, error) {
	if tx == nil {
		return nil, nil, nil
	}
	invoiceID := strings.TrimSpace(tx.XenditID)
	if invoiceID == "" {
		return nil, nil, nil
	}
	if !shouldSyncInvoiceStatus(tx.Status) {
		return nil, nil, nil
	}
	endpoint := fmt.Sprintf("/v2/invoices/%s", url.PathEscape(invoiceID))
	respBody, statusCode, err := s.callXendit(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, nil, err
	}
	if statusCode >= 300 {
		return nil, nil, fmt.Errorf("xendit invoice lookup failed: status %d", statusCode)
	}
	var invoiceData map[string]any
	if err := json.Unmarshal(respBody, &invoiceData); err != nil {
		return nil, nil, err
	}
	update := storage.PaymentTransactionUpdate{
		Status:      stringFromAny(invoiceData["status"]),
		Reference:   stringFromAny(invoiceData["merchant_reference"]),
		ExternalID:  stringFromAny(invoiceData["external_id"]),
		InvoiceURL:  stringFromAny(invoiceData["invoice_url"]),
		Method:      "xendit_invoice",
		Channel:     strings.ToLower(strings.TrimSpace(stringFromAny(invoiceData["payment_method"]))),
		Currency:    stringFromAny(invoiceData["currency"]),
		RawResponse: respBody,
	}
	if update.Reference == "" {
		update.Reference = stringFromAny(invoiceData["reference"])
	}
	if update.Channel == "" {
		update.Channel = strings.ToLower(strings.TrimSpace(stringFromAny(invoiceData["payment_channel"])))
	}
	if amountValue, ok := floatFromAny(invoiceData["amount"]); ok {
		amt := amountValue
		update.Amount = &amt
	}
	if expiry, ok := timeFromPayload(invoiceData, "expiry_date", "expiry_at", "expires_at"); ok {
		ex := expiry
		update.ExpiresAt = &ex
	}
	txResult, updatedOrder, err := s.Store.ApplyPaymentTransactionUpdate(invoiceID, update.Reference, update.ExternalID, update)
	if err != nil {
		return nil, nil, err
	}
	return txResult, updatedOrder, nil
}

func (s *Server) createDisbursementForOrder(ctx context.Context, order *models.Order, amount float64, bankCode, accountNumber, accountHolderName, email, notes string) (*models.PaymentTransaction, *models.Order, error) {
	if order == nil {
		return nil, nil, errors.New("order is required")
	}
	if strings.TrimSpace(s.xenditAPIKey) == "" {
		return nil, nil, errors.New("xendit api key not configured")
	}
	normalizedBank := strings.ToUpper(strings.TrimSpace(bankCode))
	if normalizedBank == "" {
		return nil, nil, errors.New("bank_code is required")
	}
	accountNumber = strings.TrimSpace(accountNumber)
	if accountNumber == "" {
		return nil, nil, errors.New("account_number is required")
	}
	holderName := strings.TrimSpace(accountHolderName)
	if holderName == "" {
		holderName = strings.TrimSpace(order.CustomerName)
	}
	if holderName == "" {
		holderName = "Customer"
	}
	amountValue := roundCurrency(amount)
	if amountValue <= 0 {
		amountValue = roundCurrency(order.Amount)
	}
	if amountValue <= 0 {
		return nil, nil, errors.New("amount must be greater than zero")
	}
	disbursementAmount := int64(math.Round(amountValue))
	if disbursementAmount <= 0 {
		disbursementAmount = 1
	}
	externalID := fmt.Sprintf("order-%d-refund-%d", order.ID, time.Now().UnixNano())
	description := fmt.Sprintf("Refund for order #%d", order.ID)
	if trimmed := strings.TrimSpace(notes); trimmed != "" {
		description = fmt.Sprintf("%s • %s", description, trimmed)
	}
	payload := map[string]any{
		"external_id":         externalID,
		"amount":              disbursementAmount,
		"bank_code":           normalizedBank,
		"account_holder_name": holderName,
		"account_number":      accountNumber,
		"description":         description,
		"metadata": map[string]any{
			"order_id":         order.ID,
			"customer_email":   order.CustomerEmail,
			"customer_name":    order.CustomerName,
			"customer_phone":   order.CustomerPhone,
			"payment_category": "refund_disbursement",
		},
	}
	if trimmedEmail := strings.TrimSpace(email); trimmedEmail != "" {
		payload["email_to"] = []string{trimmedEmail}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}
	respBody, statusCode, err := s.callXendit(ctx, http.MethodPost, "/disbursements", body)
	if err != nil {
		return nil, nil, err
	}
	if statusCode >= 300 {
		return nil, nil, fmt.Errorf("xendit disbursement failed: status %d", statusCode)
	}
	var disbData map[string]any
	if err := json.Unmarshal(respBody, &disbData); err != nil {
		return nil, nil, err
	}
	if ext := stringFromAny(disbData["external_id"]); ext != "" {
		externalID = ext
	}
	xenditID := stringFromAny(disbData["id"])
	status := strings.ToUpper(stringFromAny(disbData["status"]))
	if status == "" {
		status = "PENDING"
	}
	currency := stringFromAny(disbData["currency"])
	if amountResp, ok := floatFromAny(disbData["amount"]); ok {
		amountValue = amountResp
	}
	tx := &models.PaymentTransaction{
		OrderID:              order.ID,
		Method:               "xendit_disbursement",
		Channel:              normalizedBank,
		Status:               status,
		Amount:               amountValue,
		Currency:             currency,
		Reference:            fmt.Sprintf("REFUND-%d", order.ID),
		ExternalID:           externalID,
		XenditID:             xenditID,
		VirtualAccountNumber: accountNumber,
		BankCode:             normalizedBank,
		RawResponse:          respBody,
	}
	storedTx, updatedOrder, err := s.Store.CreatePaymentTransaction(tx)
	if err != nil {
		return nil, nil, err
	}
	return storedTx, updatedOrder, nil
}

func (s *Server) handleXenditWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	if token := strings.TrimSpace(s.xenditCallbackToken); token != "" {
		if !strings.EqualFold(strings.TrimSpace(r.Header.Get("X-CALLBACK-TOKEN")), token) {
			s.writeErrorMsg(w, http.StatusUnauthorized, "invalid callback token")
			return
		}
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	data := payload
	if nested, ok := payload["data"].(map[string]any); ok {
		data = nested
	}

	eventType := strings.ToLower(strings.TrimSpace(stringFromAny(payload["event"])))
	if eventType == "" {
		eventType = strings.ToLower(strings.TrimSpace(stringFromAny(payload["type"])))
	}
	if eventType == "" {
		eventType = strings.ToLower(strings.TrimSpace(stringFromAny(data["event"])))
	}

	category := "generic"
	switch {
	case strings.Contains(eventType, "invoice"):
		category = "invoice"
	case strings.Contains(eventType, "disbursement"):
		category = "disbursement"
	}
	if category == "generic" {
		if strings.TrimSpace(stringFromAny(data["invoice_url"])) != "" {
			category = "invoice"
		} else if strings.Contains(strings.ToLower(strings.TrimSpace(stringFromAny(data["type"]))), "disbursement") {
			category = "disbursement"
		}
	}
	if category == "generic" {
		methodHint := strings.ToUpper(strings.TrimSpace(stringFromAny(data["payment_method"])))
		if methodHint == "" {
			methodHint = strings.ToUpper(strings.TrimSpace(stringFromAny(data["payment_method_type"])))
		}
		if methodHint == "" {
			methodHint = strings.ToUpper(strings.TrimSpace(stringFromAny(data["channel_category"])))
		}
		if methodHint == "" {
			methodHint = strings.ToUpper(strings.TrimSpace(stringFromAny(data["type"])))
		}
		switch methodHint {
		case "QRIS", "QR_CODE":
			category = "qris"
		case "CALLBACK_VIRTUAL_ACCOUNT", "VIRTUAL_ACCOUNT", "BANK_TRANSFER":
			category = "virtual_account"
		case "EWALLET", "E_WALLET":
			category = "ewallet"
		case "RETAIL_OUTLET", "RETAIL":
			category = "retail_outlet"
		case "PAYLATER", "PAY_LATER":
			category = "paylater"
		case "CARD", "CREDIT_CARD":
			category = "card"
		}
	}
	if category == "generic" {
		switch {
		case stringFromAny(data["virtual_account_number"]) != "" || stringFromAny(data["bank_code"]) != "":
			category = "virtual_account"
		case stringFromAny(data["payment_code"]) != "" && stringFromAny(data["retail_outlet_name"]) != "":
			category = "retail_outlet"
		case stringFromAny(data["qr_string"]) != "" || stringFromAny(data["qr_code_url"]) != "":
			category = "qris"
		case stringFromAny(data["channel_code"]) != "":
			category = "ewallet"
		case strings.Contains(strings.ToLower(stringFromAny(data["type"])), "card"):
			category = "card"
		}
	}

	var update storage.PaymentTransactionUpdate
	var xenditID string
	var reference string
	var externalID string

	switch category {
	case "invoice":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		reference = stringFromAny(data["merchant_reference"])
		if reference == "" {
			reference = stringFromAny(payload["merchant_reference"])
		}
		if reference == "" {
			reference = stringFromAny(data["reference"])
		}
		if reference == "" {
			reference = stringFromAny(data["reference_id"])
		}
		if reference == "" {
			reference = stringFromAny(payload["reference_id"])
		}
		externalID = stringFromAny(data["external_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["external_id"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		channel := strings.ToLower(strings.TrimSpace(stringFromAny(data["payment_method"])))
		if channel == "" {
			channel = strings.ToLower(strings.TrimSpace(stringFromAny(data["payment_channel"])))
		}
		currency := stringFromAny(data["currency"])
		if currency == "" {
			currency = stringFromAny(payload["currency"])
		}
		update = storage.PaymentTransactionUpdate{
			Status:      status,
			Reference:   reference,
			ExternalID:  externalID,
			InvoiceURL:  stringFromAny(data["invoice_url"]),
			Method:      "xendit_invoice",
			Channel:     channel,
			Currency:    currency,
			RawResponse: body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		} else if paid, ok := floatFromAny(data["paid_amount"]); ok {
			amt := paid
			update.Amount = &amt
		}
		if expiry, ok := timeFromPayload(data, "expiry_date", "expiry_at", "expires_at"); ok {
			ex := expiry
			update.ExpiresAt = &ex
		}
	case "disbursement":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		reference = stringFromAny(data["reference"])
		if reference == "" {
			reference = stringFromAny(data["merchant_reference"])
		}
		if reference == "" {
			reference = stringFromAny(payload["reference"])
		}
		externalID = stringFromAny(data["external_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["external_id"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		bankCode := strings.ToUpper(stringFromAny(data["bank_code"]))
		accountNumber := stringFromAny(data["account_number"])
		update = storage.PaymentTransactionUpdate{
			Status:               status,
			Reference:            reference,
			ExternalID:           externalID,
			BankCode:             bankCode,
			VirtualAccountNumber: accountNumber,
			Method:               "xendit_disbursement",
			Channel:              bankCode,
			Currency:             stringFromAny(data["currency"]),
			RawResponse:          body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
	case "qris":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		reference = stringFromAny(data["reference_id"])
		if reference == "" {
			reference = stringFromAny(payload["reference_id"])
		}
		externalID = stringFromAny(data["external_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["external_id"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		update = storage.PaymentTransactionUpdate{
			Status:      status,
			Reference:   reference,
			ExternalID:  externalID,
			Method:      "QRIS",
			Channel:     "QRIS",
			QRCodeURL:   stringFromAny(data["qr_code_url"]),
			QRString:    stringFromAny(data["qr_string"]),
			CheckoutURL: stringFromAny(data["checkout_url"]),
			RawResponse: body,
		}
		if update.QRCodeURL == "" {
			update.QRCodeURL = stringFromAny(data["qr_code"])
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
		if expiry, ok := timeFromPayload(data, "expires_at", "expiry_date"); ok {
			ex := expiry
			update.ExpiresAt = &ex
		}
	case "virtual_account":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		reference = stringFromAny(data["merchant_reference"])
		if reference == "" {
			reference = stringFromAny(payload["merchant_reference"])
		}
		externalID = stringFromAny(data["external_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["external_id"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		bankCode := strings.ToUpper(stringFromAny(data["bank_code"]))
		vaNumber := stringFromAny(data["account_number"])
		if vaNumber == "" {
			vaNumber = stringFromAny(data["virtual_account_number"])
		}
		update = storage.PaymentTransactionUpdate{
			Status:               status,
			Reference:            reference,
			ExternalID:           externalID,
			Method:               "VIRTUAL_ACCOUNT",
			Channel:              bankCode,
			BankCode:             bankCode,
			VirtualAccountNumber: vaNumber,
			RawResponse:          body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
		if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
			ex := expiry
			update.ExpiresAt = &ex
		}
	case "ewallet":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		externalID = stringFromAny(data["reference_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["reference_id"])
		}
		reference = stringFromAny(data["merchant_reference"])
		if reference == "" {
			reference = stringFromAny(payload["merchant_reference"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		channel := strings.ToUpper(stringFromAny(data["channel_code"]))
		checkout := stringFromAny(data["checkout_url"])
		if actions, ok := data["actions"].(map[string]any); ok {
			if checkout == "" {
				checkout = stringFromAny(actions["desktop_web_checkout_url"])
			}
			if checkout == "" {
				checkout = stringFromAny(actions["mobile_web_checkout_url"])
			}
		}
		update = storage.PaymentTransactionUpdate{
			Status:      status,
			Reference:   reference,
			ExternalID:  externalID,
			Method:      "EWALLET",
			Channel:     channel,
			CheckoutURL: checkout,
			RawResponse: body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
		if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
			ex := expiry
			update.ExpiresAt = &ex
		}
	case "retail_outlet":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		externalID = stringFromAny(data["external_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["external_id"])
		}
		reference = stringFromAny(data["reference"])
		if reference == "" {
			reference = stringFromAny(payload["reference"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		outlet := strings.ToUpper(stringFromAny(data["retail_outlet_name"]))
		update = storage.PaymentTransactionUpdate{
			Status:      status,
			Reference:   reference,
			ExternalID:  externalID,
			Method:      "RETAIL_OUTLET",
			Channel:     outlet,
			PaymentCode: stringFromAny(data["payment_code"]),
			RawResponse: body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
		if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
			ex := expiry
			update.ExpiresAt = &ex
		}
	case "paylater":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		externalID = stringFromAny(data["reference_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["reference_id"])
		}
		reference = stringFromAny(data["merchant_reference"])
		if reference == "" {
			reference = stringFromAny(payload["merchant_reference"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		channel := strings.ToUpper(stringFromAny(data["channel_code"]))
		checkout := stringFromAny(data["checkout_url"])
		if actions, ok := data["actions"].(map[string]any); ok {
			if checkout == "" {
				checkout = stringFromAny(actions["mobile_web_checkout_url"])
			}
			if checkout == "" {
				checkout = stringFromAny(actions["desktop_web_checkout_url"])
			}
		}
		update = storage.PaymentTransactionUpdate{
			Status:      status,
			Reference:   reference,
			ExternalID:  externalID,
			Method:      "PAYLATER",
			Channel:     channel,
			CheckoutURL: checkout,
			RawResponse: body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
		if expiry, ok := timeFromPayload(data, "expiration_date", "expiry_date", "expires_at"); ok {
			ex := expiry
			update.ExpiresAt = &ex
		}
	case "card":
		status := strings.ToUpper(stringFromAny(data["status"]))
		if status == "" {
			status = strings.ToUpper(stringFromAny(payload["status"]))
		}
		externalID = stringFromAny(data["external_id"])
		if externalID == "" {
			externalID = stringFromAny(payload["external_id"])
		}
		reference = stringFromAny(data["merchant_reference"])
		if reference == "" {
			reference = stringFromAny(payload["merchant_reference"])
		}
		xenditID = stringFromAny(data["id"])
		if xenditID == "" {
			xenditID = stringFromAny(data["credit_card_charge_id"])
		}
		if xenditID == "" {
			xenditID = stringFromAny(payload["id"])
		}
		channel := strings.ToUpper(stringFromAny(data["card_brand"]))
		update = storage.PaymentTransactionUpdate{
			Status:      status,
			Reference:   reference,
			ExternalID:  externalID,
			Method:      "CARD",
			Channel:     channel,
			CheckoutURL: stringFromAny(data["redirect_url"]),
			RawResponse: body,
		}
		if amountValue, ok := floatFromAny(data["amount"]); ok {
			amt := amountValue
			update.Amount = &amt
		}
	default:
		s.writeJSON(w, http.StatusOK, map[string]any{"status": "ignored"})
		return
	}

	if xenditID == "" && reference == "" && externalID == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "missing transaction identifiers")
		return
	}

	tx, order, err := s.Store.ApplyPaymentTransactionUpdate(xenditID, reference, externalID, update)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, os.ErrNotExist) {
			statusCode = http.StatusNotFound
		}
		s.writeError(w, statusCode, err)
		return
	}
	go func() {
		if _, err := s.syncPayments(context.Background()); err != nil {
			log.Printf("payment sync error: %v", err)
		}
	}()
	response := map[string]any{
		"status":      "ok",
		"transaction": tx,
	}
	if order != nil {
		response["order"] = order
	}
	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) handlePromoValidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	var payload struct {
		Code  string  `json:"code"`
		Total float64 `json:"total"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	code := strings.TrimSpace(payload.Code)
	if code == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "promo code is required")
		return
	}
	total := payload.Total
	if total < 0 {
		total = 0
	}
	promo, err := s.Store.ValidatePromoCode(code, time.Now().UTC())
	if err != nil {
		status := http.StatusInternalServerError
		msg := err.Error()
		switch {
		case errors.Is(err, storage.ErrPromoNotFound):
			status = http.StatusNotFound
			msg = "promo code not found"
		case errors.Is(err, storage.ErrPromoInactive):
			status = http.StatusBadRequest
			msg = "promo code inactive"
		case errors.Is(err, storage.ErrPromoNotStarted):
			status = http.StatusBadRequest
			msg = "promo code not yet valid"
		case errors.Is(err, storage.ErrPromoExpired):
			status = http.StatusBadRequest
			msg = "promo code expired"
		case errors.Is(err, storage.ErrPromoUsageExceeded):
			status = http.StatusBadRequest
			msg = "promo code usage limit reached"
		}
		s.writeErrorMsg(w, status, msg)
		return
	}
	discount := roundCurrency(total * promo.DiscountPercent / 100)
	if discount > total {
		discount = total
	}
	final := roundCurrency(total - discount)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"code":             promo.Code,
		"discount_percent": promo.DiscountPercent,
		"discount_amount":  discount,
		"final_total":      final,
		"max_usage":        promo.MaxUsage,
		"used_count":       promo.UsedCount,
		"valid_from":       promo.ValidFrom,
		"valid_until":      promo.ValidUntil,
		"active":           promo.Active,
	})
}

func (s *Server) handleContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	var payload struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Subject string `json:"subject"`
		Message string `json:"message"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	payload.Name = strings.TrimSpace(payload.Name)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Subject = strings.TrimSpace(payload.Subject)
	payload.Message = strings.TrimSpace(payload.Message)
	if payload.Name == "" || payload.Email == "" || payload.Message == "" || payload.Subject == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "name, email, subject, and message are required")
		return
	}
	msg := &models.Message{
		Name:    payload.Name,
		Email:   payload.Email,
		Subject: payload.Subject,
		Body:    payload.Message,
	}
	created, err := s.Store.CreateMessage(msg)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail != "" {
		subject, htmlBody, textBody, err := utils.BuildContactNotificationEmail(created)
		if err != nil {
			log.Printf("Failed to build contact notification email: %v", err)
		} else {
			go func() {
				if err := utils.SendEmail(adminEmail, subject, htmlBody, textBody); err != nil {
					log.Printf("Failed to send contact form email: %v", err)
				}
			}()
		}
	}
	s.writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleAnalyticsEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}

	var payload analyticsEventPayload
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}

	event := payload.toModel()
	if event.Metadata == nil {
		event.Metadata = make(map[string]string)
	}

	if ua := strings.TrimSpace(r.UserAgent()); ua != "" && event.Metadata["user_agent"] == "" {
		event.Metadata["user_agent"] = ua
	}
	if ip := clientIPFromRequest(r); ip != "" {
		event.Metadata["ip"] = ip
	}
	if event.Country == "" {
		if cc := strings.TrimSpace(r.Header.Get("X-Country-Code")); cc != "" {
			event.Country = cc
		} else {
			event.Country = guessCountryFromAcceptLanguage(r.Header.Get("Accept-Language"))
		}
	}
	event.EventType = strings.ToLower(strings.TrimSpace(event.EventType))
	if event.EventType == "" {
		event.EventType = "custom"
	}
	if _, ok := allowedEventTypes[event.EventType]; !ok {
		s.writeErrorMsg(w, http.StatusBadRequest, "unsupported event_type")
		return
	}

	event.EventName = strings.ToLower(strings.TrimSpace(event.EventName))
	if event.EventType == "page_view" {
		event.EventName = "page_view"
	} else if event.EventType == "interaction" {
		if event.EventName == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "event_name required for interaction")
			return
		}
		if _, ok := allowedInteractionEvents[event.EventName]; !ok {
			s.writeErrorMsg(w, http.StatusBadRequest, "unsupported interaction event_name")
			return
		}
	} else if event.EventName == "" {
		event.EventName = event.EventType
	}

	if event.PagePath == "" {
		event.PagePath = strings.TrimSpace(r.Header.Get("X-Page-Path"))
	}
	if event.PagePath != "" && !strings.HasPrefix(event.PagePath, "/") {
		if parsed, err := url.Parse(event.PagePath); err == nil && parsed.Path != "" {
			event.PagePath = parsed.Path
		}
		if !strings.HasPrefix(event.PagePath, "/") {
			event.PagePath = "/" + strings.TrimPrefix(event.PagePath, "./")
		}
	}

	if _, err := s.Store.RecordAnalyticsEvent(event); err != nil {
		log.Printf("failed to record analytics event: %v", err)
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}

	s.writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
}

func (s *Server) handleOrderRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	if r.Method == http.MethodPost && strings.HasSuffix(path, "/request") {
		s.handleOrderRequest(w, r)
		return
	}
	if r.Method == http.MethodPost && strings.HasSuffix(path, "/rating") {
		s.handleOrderRating(w, r)
		return
	}
	if r.Method == http.MethodPost && strings.HasSuffix(path, "/card-charge") {
		s.handleOrderCardCharge(w, r)
		return
	}
	if r.Method == http.MethodGet && !strings.Contains(path, "/") {
		s.handleOrderByID(w, r)
		return
	}
	s.notFound(w)
}

func (s *Server) handleOrderRating(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	idStr := strings.TrimSuffix(path, "/rating")
	id, err := parseID(idStr)
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
		return
	}

	var payload struct {
		Rating int    `json:"rating"`
		Review string `json:"review"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}

	payload.Review = strings.TrimSpace(payload.Review)

	updatedOrder, err := s.Store.SetOrderRating(id, payload.Rating, payload.Review)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			s.notFound(w)
			return
		}
		s.writeErrorMsg(w, http.StatusBadRequest, err.Error())
		return
	}

	s.writeJSON(w, http.StatusOK, updatedOrder)
}

func (s *Server) handleOrderCardCharge(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	idStr := strings.TrimSuffix(path, "/card-charge")
	id, err := parseID(idStr)
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
		return
	}
	var payload struct {
		TokenID   string `json:"token_id"`
		CardBrand string `json:"card_brand"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	token := strings.TrimSpace(payload.TokenID)
	if token == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "token_id is required")
		return
	}
	brand := strings.ToUpper(strings.TrimSpace(payload.CardBrand))
	if brand != "" && !isValidCardBrand(brand) {
		s.writeErrorMsg(w, http.StatusBadRequest, "unsupported card brand")
		return
	}
	order, ok := s.Store.GetOrderByID(id)
	if !ok {
		s.notFound(w)
		return
	}
	latestTx, _ := s.Store.GetLatestPaymentTransactionByOrder(order.ID)
	if allowed, reason := paymentAccessState(order, latestTx); !allowed {
		if reason == "" {
			reason = "Payment session is no longer available for this order"
		}
		s.writeErrorMsg(w, http.StatusForbidden, reason)
		return
	}
	tx, updatedOrder, err := s.createCardPayment(r.Context(), order, brand, token)
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if errors.Is(err, errPaymentWindowClosed) {
			status = http.StatusForbidden
			msg = "payment session is no longer available for this order"
			if allowed, reason := paymentAccessState(order, latestTx); !allowed && reason != "" {
				msg = reason
			}
		}
		s.writeErrorMsg(w, status, msg)
		return
	}
	response := map[string]any{
		"transaction": tx,
	}
	if updatedOrder != nil {
		response["order"] = updatedOrder
	}
	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleOrderRequest(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	idStr := strings.TrimSuffix(path, "/request")
	id, err := parseID(idStr)
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
		return
	}

	var payload struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}

	if payload.Reason == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "reason is required")
		return
	}

	var statusToUpdate string
	switch payload.Action {
	case "cancel":
		statusToUpdate = "cancelled_by_user"
	case "refund":
		statusToUpdate = "refund_pending"
	default:
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid action")
		return
	}

	if _, err := s.Store.UpdateRequest(id, statusToUpdate, payload.Reason); err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}

	if payload.Action == "refund" {
		order, ok := s.Store.GetOrderByID(id)
		if ok {
			service, _ := s.Store.GetServiceByID(order.ServiceID)
			adminEmail := os.Getenv("ADMIN_EMAIL")
			if adminEmail != "" {
				subject, htmlBody, textBody, err := utils.BuildRefundRequestEmail(order, service, payload.Reason)
				if err != nil {
					log.Printf("Failed to build refund request email: %v", err)
				} else {
					go func() {
						if err := utils.SendEmail(adminEmail, subject, htmlBody, textBody); err != nil {
							log.Printf("Failed to send refund request notification email: %v", err)
						}
					}()
				}
			}
		}
	}

	s.writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func isSuccessfulPaymentStatus(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "PAID", "COMPLETED", "SUCCESS", "SETTLED":
		return true
	default:
		return false
	}
}

func isClosedPaymentStatus(status string) bool {
	if status == "" {
		return false
	}
	upper := strings.ToUpper(strings.TrimSpace(status))
	switch upper {
	case "PENDING", "UNPAID", "NEEDS_ACTION", "REQUIRES_ACTION", "AWAITING_PAYMENT", "IN_PROGRESS":
		return false
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
	if strings.Contains(upper, "VOID") {
		return true
	}
	if strings.Contains(upper, "REFUND") {
		return true
	}
	return false
}

func paymentExpiryTime(order *models.Order, tx *models.PaymentTransaction) time.Time {
	if tx != nil && !tx.ExpiresAt.IsZero() {
		return tx.ExpiresAt
	}
	if order != nil && !order.PaymentExpiresAt.IsZero() {
		return order.PaymentExpiresAt
	}
	return time.Time{}
}

func effectiveOrderStatus(order *models.Order, tx *models.PaymentTransaction) (string, string) {
	if order == nil {
		return "", ""
	}
	currentStatus := strings.TrimSpace(order.Status)
	normalizedStatus := strings.ToLower(currentStatus)
	if normalizedStatus == "" {
		normalizedStatus = currentStatus
	}

	finalizedStatuses := map[string]struct{}{
		"done":               {},
		"cancelled":          {},
		"cancelled_by_user":  {},
		"cancelled_by_admin": {},
		"payment_invalid":    {},
		"refunded":           {},
		"refund_pending":     {},
		"refund_rejected":    {},
	}

	paymentStatus := strings.ToUpper(strings.TrimSpace(order.PaymentStatus))
	if paymentStatus == "" && tx != nil {
		paymentStatus = strings.ToUpper(strings.TrimSpace(tx.Status))
	}

	if _, ok := finalizedStatuses[normalizedStatus]; ok {
		if storage.IsCancelledStatus(currentStatus) && order.CancelReason == "" && storage.IsPaymentFailureStatus(paymentStatus) {
			return currentStatus, storage.PaymentCancelReason(paymentStatus)
		}
		return currentStatus, ""
	}

	if storage.IsPaymentFailureStatus(paymentStatus) {
		return "cancelled_by_admin", storage.PaymentCancelReason(paymentStatus)
	}

	expiry := paymentExpiryTime(order, tx)
	if !expiry.IsZero() && time.Now().UTC().After(expiry) {
		if normalizedStatus == "pending" || normalizedStatus == "awaiting_confirmation" {
			return "cancelled_by_admin", storage.PaymentCancelReason("EXPIRED")
		}
	}

	return currentStatus, ""
}

func paymentAccessState(order *models.Order, tx *models.PaymentTransaction) (bool, string) {
	if order == nil {
		return false, "Order not found"
	}
	if storage.IsCancelledStatus(order.Status) {
		reason := strings.TrimSpace(order.CancelReason)
		if reason == "" {
			reason = "Order has been cancelled"
		}
		return false, reason
	}
	status := strings.ToUpper(strings.TrimSpace(order.PaymentStatus))
	if status == "" && tx != nil {
		status = strings.ToUpper(strings.TrimSpace(tx.Status))
	}
	if storage.IsPaymentFailureStatus(status) {
		reason := storage.PaymentCancelReason(status)
		if reason == "" {
			reason = "Payment is no longer valid"
		}
		return false, reason
	}
	expiry := paymentExpiryTime(order, tx)
	if !expiry.IsZero() && time.Now().UTC().After(expiry) {
		reason := storage.PaymentCancelReason("EXPIRED")
		if reason == "" {
			reason = "Payment is no longer valid"
		}
		return false, reason
	}
	return true, ""
}

func normalizePaymentMethodName(value string) string {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "BANK_TRANSFER", "VIRTUAL_ACCOUNT":
		return "VIRTUAL_ACCOUNT"
	case "QR_CODE", "QRIS":
		return "QRIS"
	default:
		return strings.ToUpper(strings.TrimSpace(value))
	}
}

func canReusePaymentTransaction(order *models.Order, tx *models.PaymentTransaction, category, channel string) bool {
	if order == nil || tx == nil {
		return false
	}
	normalizedCategory := normalizePaymentMethodName(category)
	if normalizedCategory == "" {
		return false
	}
	if normalizedCategory == "CARD" {
		return false
	}
	method := normalizePaymentMethodName(tx.Method)
	if method == "" || method != normalizedCategory {
		return false
	}
	normalizedChannel := strings.ToUpper(strings.TrimSpace(channel))
	txChannel := strings.ToUpper(strings.TrimSpace(tx.Channel))
	if method == "VIRTUAL_ACCOUNT" && txChannel == "" {
		txChannel = strings.ToUpper(strings.TrimSpace(tx.BankCode))
	}
	if method == "QRIS" {
		if normalizedChannel == "" {
			normalizedChannel = "QRIS"
		}
		if txChannel == "" {
			txChannel = "QRIS"
		}
	}
	if normalizedChannel != "" && txChannel != "" && !strings.EqualFold(txChannel, normalizedChannel) {
		return false
	}
	status := strings.ToUpper(strings.TrimSpace(tx.Status))
	reusableStatuses := map[string]struct{}{
		"":                 {},
		"PENDING":          {},
		"UNPAID":           {},
		"AWAITING_PAYMENT": {},
		"NEEDS_ACTION":     {},
		"REQUIRES_ACTION":  {},
		"IN_PROGRESS":      {},
	}
	if _, ok := reusableStatuses[status]; !ok {
		return false
	}
	expiry := paymentExpiryTime(order, tx)
	if !expiry.IsZero() && time.Now().UTC().After(expiry) {
		return false
	}
	return true
}

func isOrderPaymentWindowClosed(order *models.Order, tx *models.PaymentTransaction) bool {
	allowed, _ := paymentAccessState(order, tx)
	return !allowed
}

func (s *Server) handleOrderByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	id, err := parseID(path)
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
		return
	}
	order, ok := s.Store.GetOrderByID(id)
	if !ok {
		s.notFound(w)
		return
	}
	latestTx, _ := s.Store.GetLatestPaymentTransactionByOrder(order.ID)
	if latestTx != nil && strings.EqualFold(latestTx.Method, "xendit_invoice") {
		if updatedTx, updatedOrder, err := s.syncInvoiceStatus(r.Context(), latestTx); err == nil {
			if updatedTx != nil {
				latestTx = updatedTx
			}
			if updatedOrder != nil {
				order = updatedOrder
			}
		} else {
			log.Printf("failed to sync invoice status for order %d: %v", order.ID, err)
		}
	}
	if allowed, reason := paymentAccessState(order, latestTx); !allowed {
		if reason == "" {
			reason = "Payment session is no longer available for this order"
		}
		s.writeErrorMsg(w, http.StatusForbidden, reason)
		return
	}
	if latestTx != nil {
		response := struct {
			models.Order
			LatestTransaction *models.PaymentTransaction `json:"latest_transaction"`
		}{
			Order:             *order,
			LatestTransaction: latestTx,
		}
		s.writeJSON(w, http.StatusOK, response)
		return
	}
	s.writeJSON(w, http.StatusOK, order)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	admin, ok := s.Store.FindAdminByEmail(payload.Email)
	if !ok || !auth.CheckPassword(admin.PasswordHash, payload.Password) {
		s.writeErrorMsg(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := auth.GenerateToken(admin.Email, 6*time.Hour)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]string{"access_token": token})
}

func (s *Server) handleUserRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	var payload struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	email := strings.TrimSpace(payload.Email)
	name := strings.TrimSpace(payload.Name)
	password := strings.TrimSpace(payload.Password)
	if !isValidEmail(email) {
		s.writeErrorMsg(w, http.StatusBadRequest, "email tidak valid")
		return
	}
	if len(password) < 6 {
		s.writeErrorMsg(w, http.StatusBadRequest, "password minimal 6 karakter")
		return
	}
	user, err := s.createLocalUser(r.Context(), email, name, auth.HashPassword(password))
	if err != nil {
		if errors.Is(err, repository.ErrEmailAlreadyUsed) {
			s.writeErrorMsg(w, http.StatusConflict, "email sudah terdaftar")
			return
		}
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	if _, err := s.recordUserLogin(r.Context(), user.ID, time.Now().UTC()); err != nil {
		log.Printf("failed to update user login time: %v", err)
	}
	accessToken, err := s.issueTokens(w, r, user, "")
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.writeJSON(w, http.StatusCreated, s.newAuthResponse(accessToken, user))
}

func (s *Server) handleUserLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := s.decodeJSON(r.Body, &payload); err != nil {
		s.writeError(w, http.StatusBadRequest, err)
		return
	}
	email := strings.TrimSpace(payload.Email)
	password := strings.TrimSpace(payload.Password)
	if !isValidEmail(email) || password == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "kredensial tidak valid")
		return
	}
	user, err := s.findUserByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			s.writeErrorMsg(w, http.StatusUnauthorized, "email atau password salah")
			return
		}
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	if strings.TrimSpace(user.PasswordHash) == "" {
		s.writeErrorMsg(w, http.StatusBadRequest, "akun ini belum memiliki password")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, password) {
		s.writeErrorMsg(w, http.StatusUnauthorized, "email atau password salah")
		return
	}
	if updated, err := s.recordUserLogin(r.Context(), user.ID, time.Now().UTC()); err == nil {
		user = updated
	}
	accessToken, err := s.issueTokens(w, r, user, "")
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.writeJSON(w, http.StatusOK, s.newAuthResponse(accessToken, user))
}

func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	if s.googleOAuthConfig == nil {
		s.writeErrorMsg(w, http.StatusServiceUnavailable, "google oauth not configured")
		return
	}

	mode := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("mode")))
	if mode == "" {
		mode = "login"
	}
	redirect := r.URL.Query().Get("redirect")

	if mode == "link" {
		if s.userRepo == nil && s.Store == nil {
			s.writeErrorMsg(w, http.StatusServiceUnavailable, "linking not supported")
			return
		}
		if _, _, err := s.resolveUser(w, r); err != nil {
			s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
	} else {
		mode = "login"
	}

	state, err := s.buildOAuthState(redirect, mode, "google")
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	authURL := s.googleOAuthConfig.AuthCodeURL(
		state,
		oauth2.AccessTypeOnline,
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)
	http.Redirect(w, r, authURL, http.StatusFound)
}
func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	if s.googleOAuthConfig == nil {
		s.writeErrorMsg(w, http.StatusServiceUnavailable, "google oauth not configured")
		return
	}

	query := r.URL.Query()
	if errMsg := query.Get("error"); errMsg != "" {
		params := url.Values{}
		params.Set("error", errMsg)
		if desc := query.Get("error_description"); desc != "" {
			params.Set("error_description", desc)
		}
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	redirectPath, mode, provider, err := s.verifyOAuthState(query.Get("state"))
	if mode == "" {
		mode = "login"
	}
	if err != nil {
		log.Printf("google oauth state error: %v", err)
		params := url.Values{}
		params.Set("error", "invalid_state")
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}
	if provider == "" {
		provider = "google"
	}

	code := query.Get("code")
	if code == "" {
		params := url.Values{}
		params.Set("error", "missing_code")
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	ctx := r.Context()
	token, err := s.googleOAuthConfig.Exchange(ctx, code)
	if err != nil {
		log.Printf("google oauth exchange failed: %v", err)
		params := url.Values{}
		params.Set("error", "oauth_exchange_failed")
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	userInfo, err := s.fetchGoogleUser(ctx, token)
	if err != nil {
		log.Printf("google userinfo fetch failed: %v", err)
		params := url.Values{}
		params.Set("error", "userinfo_failed")
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	now := time.Now().UTC()
	if mode == "link" {
		_, currentUser, authErr := s.resolveUser(w, r)
		if authErr != nil {
			params := url.Values{}
			params.Set("error", "unauthenticated")
			target := s.frontendURL("/login", params)
			http.Redirect(w, r, target, http.StatusFound)
			return
		}
		if _, err := s.attachOAuthUser(r.Context(), currentUser, userInfo, provider, userInfo.ID, now); err != nil {
			log.Printf("failed attaching provider: %v", err)
			params := url.Values{}
			if errors.Is(err, repository.ErrProviderAlreadyLinked) {
				params.Set("error", "provider_already_linked")
			} else {
				params.Set("error", "link_failed")
			}
			target := s.frontendURL(redirectPath, params)
			http.Redirect(w, r, target, http.StatusFound)
			return
		}
		params := url.Values{}
		params.Set("linked", "true")
		params.Set("provider", provider)
		target := s.frontendURL(redirectPath, params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	user, err := s.upsertOAuthUser(r.Context(), userInfo.Email, userInfo.Name, userInfo.Picture, provider, userInfo.ID, now)
	if err != nil {
		log.Printf("failed to upsert user: %v", err)
		params := url.Values{}
		params.Set("error", "internal_error")
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}
	if updated, err := s.recordUserLogin(r.Context(), user.ID, now); err == nil {
		user = updated
	}
	if _, err := s.issueTokens(w, r, user, ""); err != nil {
		log.Printf("failed issuing tokens: %v", err)
		params := url.Values{}
		params.Set("error", "internal_error")
		target := s.frontendURL("/login", params)
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	params := url.Values{}
	params.Set("auth", "success")
	params.Set("provider", provider)
	target := s.frontendURL(redirectPath, params)
	http.Redirect(w, r, target, http.StatusFound)
}
func (s *Server) handleAuthSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	accessToken, user, err := s.resolveUser(w, r)
	if err != nil {
		s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	s.writeJSON(w, http.StatusOK, s.newAuthResponse(accessToken, user))
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	if claims, _, err := s.readRefreshToken(r); err == nil {
		_ = s.deleteSession(r.Context(), claims.SessionID)
	}
	s.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAdminServices(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		services := s.Store.ListServices()
		categories := s.Store.ListCategories()
		catMap := make(map[uint]string, len(categories))
		for _, c := range categories {
			catMap[c.ID] = c.Name
		}
		type adminService struct {
			ID          uint                      `json:"id"`
			Title       string                    `json:"title"`
			Slug        string                    `json:"slug"`
			Price       float64                   `json:"price"`
			Category    string                    `json:"category"`
			CategoryID  uint                      `json:"category_id"`
			Summary     string                    `json:"summary"`
			Description string                    `json:"description"`
			AddOns      []models.AddOn            `json:"add_ons"`
			Highlights  []models.ServiceHighlight `json:"highlights"`
		}
		var out []adminService
		for _, svc := range services {
			out = append(out, adminService{
				ID:          svc.ID,
				Title:       svc.Title,
				Slug:        svc.Slug,
				Price:       svc.Price,
				Category:    catMap[svc.CategoryID],
				CategoryID:  svc.CategoryID,
				Summary:     svc.Summary,
				Description: svc.Description,
				AddOns:      append([]models.AddOn(nil), svc.AddOns...),
				Highlights:  append([]models.ServiceHighlight(nil), svc.Highlights...),
			})
		}
		s.writeJSON(w, http.StatusOK, out)

	case http.MethodPost:
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		defer r.MultipartForm.RemoveAll()

		service, err := s.decodeServiceForm(r.MultipartForm)
		if err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		if service.Title == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "title is required")
			return
		}
		if service.CategoryID == 0 {
			s.writeErrorMsg(w, http.StatusBadRequest, "category_id is required")
			return
		}
		if service.Price < 0 {
			s.writeErrorMsg(w, http.StatusBadRequest, "price cannot be negative")
			return
		}
		if _, ok := s.Store.GetCategoryByID(service.CategoryID); !ok {
			s.writeErrorMsg(w, http.StatusBadRequest, "invalid category")
			return
		}

		if file := getFile(r.MultipartForm, "thumbnail"); file != nil {
			name, err := utils.SaveUploadedFile(file, s.UploadDir)
			if err != nil {
				s.writeError(w, http.StatusInternalServerError, err)
				return
			}
			service.Thumbnail = "/api/static/" + name
		}

		if files := getFiles(r.MultipartForm, "gallery_images"); len(files) > 0 {
			for _, file := range files {
				name, err := utils.SaveUploadedFile(file, s.UploadDir)
				if err != nil {
					s.deleteStaticFile(service.Thumbnail)
					for _, p := range service.GalleryImages {
						s.deleteStaticFile(p)
					}
					s.writeError(w, http.StatusInternalServerError, err)
					return
				}
				service.GalleryImages = append(service.GalleryImages, "/api/static/"+name)
			}
		}
		created, err := s.Store.CreateService(service)
		if err != nil {
			s.deleteStaticFile(service.Thumbnail)
			for _, p := range service.GalleryImages {
				s.deleteStaticFile(p)
			}
			s.writeError(w, http.StatusInternalServerError, err)
			return
		}
		s.writeJSON(w, http.StatusCreated, map[string]any{"status": "created", "id": created.ID})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminServiceByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(strings.TrimPrefix(r.URL.Path, "/api/admin/services/"))
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid service id")
		return
	}
	switch r.Method {
	case http.MethodPut:
		existing, _ := s.Store.GetServiceByID(id)
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		defer r.MultipartForm.RemoveAll()

		update, err := s.decodeServiceForm(r.MultipartForm)
		if err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		if update.Title == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "title is required")
			return
		}
		if update.CategoryID == 0 {
			s.writeErrorMsg(w, http.StatusBadRequest, "category_id is required")
			return
		}
		if update.Price < 0 {
			s.writeErrorMsg(w, http.StatusBadRequest, "price cannot be negative")
			return
		}
		if _, ok := s.Store.GetCategoryByID(update.CategoryID); !ok {
			s.writeErrorMsg(w, http.StatusBadRequest, "invalid category")
			return
		}
		if file := getFile(r.MultipartForm, "thumbnail"); file != nil {
			name, _ := utils.SaveUploadedFile(file, s.UploadDir)
			update.Thumbnail = "/api/static/" + name
			if existing != nil {
				s.deleteStaticFile(existing.Thumbnail)
			}
		}
		if files := getFiles(r.MultipartForm, "gallery_images"); len(files) > 0 {
			var galleryPaths []string
			for _, file := range files {
				name, _ := utils.SaveUploadedFile(file, s.UploadDir)
				galleryPaths = append(galleryPaths, "/api/static/"+name)
			}
			update.GalleryImages = galleryPaths
			if existing != nil {
				for _, p := range existing.GalleryImages {
					s.deleteStaticFile(p)
				}
			}
		}
		if _, err := s.Store.UpdateService(id, update); err != nil {
			s.deleteStaticFile(update.Thumbnail)
			for _, p := range update.GalleryImages {
				s.deleteStaticFile(p)
			}
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	case http.MethodDelete:
		if err := s.Store.DeleteService(id); err != nil {
			s.writeError(w, http.StatusInternalServerError, err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminGallery(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items := s.Store.ListGalleryItems("")
		s.writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		if err := r.ParseMultipartForm(100 << 20); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		defer r.MultipartForm.RemoveAll()

		formData, err := s.decodeGalleryForm(r.MultipartForm)
		if err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}

		item := formData.Item
		normalizeGalleryItemFields(item)
		savedPaths := make([]string, 0, 1)
		cleanup := func() {
			for _, path := range savedPaths {
				s.deleteStaticFile(path)
			}
		}
		success := false
		defer func() {
			if !success {
				cleanup()
			}
		}()

		if file := getFile(r.MultipartForm, "thumbnail"); file != nil {
			name, err := utils.SaveUploadedFile(file, s.UploadDir)
			if err != nil {
				s.writeError(w, http.StatusInternalServerError, err)
				return
			}
			item.Thumbnail = "/api/static/" + name
			savedPaths = append(savedPaths, item.Thumbnail)
		} else if formData.ExistingThumbnail != "" {
			item.Thumbnail = strings.TrimSpace(formData.ExistingThumbnail)
		}

		assets := normalizeGalleryAssetsFromForm(formData.ExistingAssets)
		if assets == nil {
			assets = []models.GalleryAsset{}
		}
		if files := getFiles(r.MultipartForm, "asset_images"); len(files) > 0 {
			for _, file := range files {
				name, err := utils.SaveUploadedFile(file, s.UploadDir)
				if err != nil {
					s.writeError(w, http.StatusInternalServerError, err)
					return
				}
				publicPath := "/api/static/" + name
				savedPaths = append(savedPaths, publicPath)
				assets = append(assets, models.GalleryAsset{URL: publicPath, Type: "image"})
			}
		}
		if files := getFiles(r.MultipartForm, "asset_pdfs"); len(files) > 0 {
			for _, file := range files {
				name, err := utils.SaveUploadedFile(file, s.UploadDir)
				if err != nil {
					s.writeError(w, http.StatusInternalServerError, err)
					return
				}
				publicPath := "/api/static/" + name
				savedPaths = append(savedPaths, publicPath)
				assets = append(assets, models.GalleryAsset{URL: publicPath, Type: "pdf"})
			}
		}
		item.Assets = normalizeGalleryAssetsFromForm(assets)

		item.VideoURL = convertDriveLinkToPreview(item.VideoURL)
		if item.Section != "videography" {
			item.VideoURL = ""
		}

		if item.Section == "design" && item.DisplayMode == "" {
			item.DisplayMode = "gallery"
		}
		if item.Section != "design" {
			item.DisplayMode = ""
		}
		if item.Section != "web" {
			item.Description = ""
		}

		normalizeGalleryItemFields(item)
		if err := validateGalleryItem(item); err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, err.Error())
			return
		}

		created, err := s.Store.CreateGalleryItem(item)
		if err != nil {
			s.writeError(w, http.StatusInternalServerError, err)
			return
		}
		success = true
		s.writeJSON(w, http.StatusCreated, map[string]any{
			"status": "created",
			"item":   created,
		})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminGalleryByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(strings.TrimPrefix(r.URL.Path, "/api/admin/gallery/"))
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid gallery id")
		return
	}
	switch r.Method {
	case http.MethodPut:
		existing, ok := s.Store.GetGalleryItemByID(id)
		if !ok {
			s.notFound(w)
			return
		}
		if err := r.ParseMultipartForm(100 << 20); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		defer r.MultipartForm.RemoveAll()

		formData, err := s.decodeGalleryForm(r.MultipartForm)
		if err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}

		item := formData.Item
		if strings.TrimSpace(item.Section) == "" {
			item.Section = existing.Section
		}
		if strings.TrimSpace(item.Title) == "" {
			item.Title = existing.Title
		}
		if strings.TrimSpace(item.Subtitle) == "" {
			item.Subtitle = existing.Subtitle
		}
		if !formData.FiltersProvided {
			item.Filters = existing.Filters
		}
		normalizeGalleryItemFields(item)

		savedPaths := make([]string, 0, 1)
		pathsToRemove := make([]string, 0)
		success := false
		defer func() {
			if !success {
				for _, path := range savedPaths {
					s.deleteStaticFile(path)
				}
			}
		}()

		thumbnailPath := existing.Thumbnail
		if file := getFile(r.MultipartForm, "thumbnail"); file != nil {
			name, err := utils.SaveUploadedFile(file, s.UploadDir)
			if err != nil {
				s.writeError(w, http.StatusInternalServerError, err)
				return
			}
			thumbnailPath = "/api/static/" + name
			savedPaths = append(savedPaths, thumbnailPath)
			if existing.Thumbnail != "" && existing.Thumbnail != thumbnailPath {
				pathsToRemove = append(pathsToRemove, existing.Thumbnail)
			}
		} else if formData.ExistingThumbnailProvided && formData.ExistingThumbnail != "" {
			thumbnailPath = strings.TrimSpace(formData.ExistingThumbnail)
		}
		item.Thumbnail = thumbnailPath

		var baseAssets []models.GalleryAsset
		if formData.ExistingAssetsProvided {
			baseAssets = formData.ExistingAssets
		} else {
			baseAssets = existing.Assets
		}
		assets := normalizeGalleryAssetsFromForm(baseAssets)
		if assets == nil {
			assets = []models.GalleryAsset{}
		}
		assetURLs := make(map[string]struct{})
		for _, asset := range assets {
			assetURLs[asset.URL] = struct{}{}
		}
		if files := getFiles(r.MultipartForm, "asset_images"); len(files) > 0 {
			for _, file := range files {
				name, err := utils.SaveUploadedFile(file, s.UploadDir)
				if err != nil {
					s.writeError(w, http.StatusInternalServerError, err)
					return
				}
				publicPath := "/api/static/" + name
				savedPaths = append(savedPaths, publicPath)
				assets = append(assets, models.GalleryAsset{URL: publicPath, Type: "image"})
				assetURLs[publicPath] = struct{}{}
			}
		}
		if files := getFiles(r.MultipartForm, "asset_pdfs"); len(files) > 0 {
			for _, file := range files {
				name, err := utils.SaveUploadedFile(file, s.UploadDir)
				if err != nil {
					s.writeError(w, http.StatusInternalServerError, err)
					return
				}
				publicPath := "/api/static/" + name
				savedPaths = append(savedPaths, publicPath)
				assets = append(assets, models.GalleryAsset{URL: publicPath, Type: "pdf"})
				assetURLs[publicPath] = struct{}{}
			}
		}
		item.Assets = normalizeGalleryAssetsFromForm(assets)
		for _, asset := range existing.Assets {
			if _, ok := assetURLs[asset.URL]; !ok && asset.URL != "" {
				pathsToRemove = append(pathsToRemove, asset.URL)
			}
		}

		if item.VideoURL == "" {
			item.VideoURL = existing.VideoURL
		}
		item.VideoURL = convertDriveLinkToPreview(item.VideoURL)
		if item.Section != "videography" {
			item.VideoURL = ""
		}

		if item.DisplayMode == "" {
			item.DisplayMode = existing.DisplayMode
		}
		if item.Section == "design" && item.DisplayMode == "" {
			item.DisplayMode = "gallery"
		}
		if item.Section != "design" {
			item.DisplayMode = ""
		}

		if strings.TrimSpace(item.Description) == "" {
			item.Description = existing.Description
		}
		if item.Section != "web" {
			item.Description = ""
		}
		if item.LinkURL == "" {
			item.LinkURL = existing.LinkURL
		}

		normalizeGalleryItemFields(item)
		if err := validateGalleryItem(item); err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, err.Error())
			return
		}

		updated, err := s.Store.UpdateGalleryItem(id, item)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}
		success = true
		for _, path := range pathsToRemove {
			s.deleteStaticFile(path)
		}
		s.writeJSON(w, http.StatusOK, map[string]any{
			"status": "updated",
			"item":   updated,
		})
	case http.MethodDelete:
		deleted, err := s.Store.DeleteGalleryItem(id)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}
		if deleted != nil {
			s.deleteStaticFile(deleted.Thumbnail)
			for _, asset := range deleted.Assets {
				s.deleteStaticFile(asset.URL)
			}
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminExperiences(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		experiences := s.Store.ListExperiences()
		s.writeJSON(w, http.StatusOK, experiences)
	case http.MethodPost:
		var payload experiencePayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, "Payload pengalaman tidak valid.")
			return
		}
		payload.sanitize()

		if payload.Period == nil || *payload.Period == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "Periode pengalaman wajib diisi.")
			return
		}
		if payload.Title == nil || *payload.Title == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "Judul pengalaman wajib diisi.")
			return
		}
		if payload.Description == nil || *payload.Description == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "Deskripsi pengalaman wajib diisi.")
			return
		}

		company := ""
		if payload.Company != nil {
			company = *payload.Company
		}
		if err := validateExperienceFields(*payload.Period, *payload.Title, company, *payload.Description); err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, err.Error())
			return
		}

		orderVal := 0
		if payload.Order != nil {
			if *payload.Order < 0 {
				s.writeErrorMsg(w, http.StatusBadRequest, "Urutan tidak boleh bernilai negatif.")
				return
			}
			orderVal = *payload.Order
		}

		experience := &models.Experience{
			Period:      *payload.Period,
			Title:       *payload.Title,
			Company:     company,
			Description: *payload.Description,
			Order:       orderVal,
		}

		created, err := s.Store.CreateExperience(experience)
		if err != nil {
			s.writeError(w, http.StatusInternalServerError, err)
			return
		}

		s.writeJSON(w, http.StatusCreated, map[string]any{
			"status":     "created",
			"experience": created,
		})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminExperienceByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(strings.TrimPrefix(r.URL.Path, "/api/admin/experiences/"))
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "ID pengalaman tidak valid.")
		return
	}

	switch r.Method {
	case http.MethodPut:
		existing, ok := s.Store.GetExperienceByID(id)
		if !ok {
			s.notFound(w)
			return
		}

		var payload experiencePayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, "Payload pengalaman tidak valid.")
			return
		}
		payload.sanitize()

		period := existing.Period
		if payload.Period != nil {
			if *payload.Period == "" {
				s.writeErrorMsg(w, http.StatusBadRequest, "Periode pengalaman wajib diisi.")
				return
			}
			period = *payload.Period
		}

		title := existing.Title
		if payload.Title != nil {
			if *payload.Title == "" {
				s.writeErrorMsg(w, http.StatusBadRequest, "Judul pengalaman wajib diisi.")
				return
			}
			title = *payload.Title
		}

		description := existing.Description
		if payload.Description != nil {
			if *payload.Description == "" {
				s.writeErrorMsg(w, http.StatusBadRequest, "Deskripsi pengalaman wajib diisi.")
				return
			}
			description = *payload.Description
		}

		company := existing.Company
		if payload.Company != nil {
			company = *payload.Company
		}

		if err := validateExperienceFields(period, title, company, description); err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, err.Error())
			return
		}

		orderVal := existing.Order
		if payload.Order != nil {
			if *payload.Order < 0 {
				s.writeErrorMsg(w, http.StatusBadRequest, "Urutan tidak boleh bernilai negatif.")
				return
			}
			if *payload.Order > 0 {
				orderVal = *payload.Order
			}
		}

		update := &models.Experience{
			Period:      period,
			Title:       title,
			Company:     company,
			Description: description,
			Order:       orderVal,
		}

		updated, err := s.Store.UpdateExperience(id, update)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}

		s.writeJSON(w, http.StatusOK, map[string]any{
			"status":     "updated",
			"experience": updated,
		})
	case http.MethodDelete:
		_, err := s.Store.DeleteExperience(id)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminCategories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.writeJSON(w, http.StatusOK, s.Store.ListCategories())
	case http.MethodPost:
		var payload struct {
			Name string `json:"name"`
			Slug string `json:"slug"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		payload.Name = strings.TrimSpace(payload.Name)
		payload.Slug = strings.TrimSpace(payload.Slug)
		if payload.Name == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "name is required")
			return
		}
		cat := &models.Category{Name: payload.Name, Slug: payload.Slug}
		created, err := s.Store.CreateCategory(cat)
		if err != nil {
			s.writeError(w, http.StatusInternalServerError, err)
			return
		}
		s.writeJSON(w, http.StatusCreated, created)
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminCategoryByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(strings.TrimPrefix(r.URL.Path, "/api/admin/categories/"))
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid category id")
		return
	}
	switch r.Method {
	case http.MethodPut:
		var payload struct {
			Name string `json:"name"`
			Slug string `json:"slug"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		payload.Name = strings.TrimSpace(payload.Name)
		payload.Slug = strings.TrimSpace(payload.Slug)
		if payload.Name == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "name is required")
			return
		}
		if _, err := s.Store.UpdateCategory(id, payload.Name, payload.Slug); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	case http.MethodDelete:
		if err := s.Store.DeleteCategory(id); err != nil {
			s.writeError(w, http.StatusInternalServerError, err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	orders := s.Store.ListOrders()
	services := s.Store.ListServices()
	svcMap := make(map[uint]string)
	for _, svc := range services {
		svcMap[svc.ID] = svc.Title
	}
	type response struct {
		models.Order
		Service           string                     `json:"service"`
		LatestTransaction *models.PaymentTransaction `json:"latest_transaction,omitempty"`
	}
	var out []response
	for _, o := range orders {
		latestTx, _ := s.Store.GetLatestPaymentTransactionByOrder(o.ID)
		orderCopy := o
		status, cancelReason := effectiveOrderStatus(&orderCopy, latestTx)
		if status != "" && !strings.EqualFold(status, orderCopy.Status) {
			orderCopy.Status = status
		}
		if cancelReason != "" && strings.TrimSpace(orderCopy.CancelReason) == "" {
			orderCopy.CancelReason = cancelReason
		}
		out = append(out, response{
			Order:             orderCopy,
			Service:           svcMap[o.ServiceID],
			LatestTransaction: latestTx,
		})
	}
	s.writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminOrderActions(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/admin/orders/")
	if strings.HasSuffix(path, "/status") {
		idStr := strings.TrimSuffix(path, "/status")
		id, err := parseID(idStr)
		if err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
			return
		}
		if r.Method != http.MethodPut {
			s.methodNotAllowed(w, r)
			return
		}
		var payload struct {
			Status string `json:"status"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		if _, err := s.Store.UpdateOrderStatus(id, payload.Status); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, os.ErrNotExist) {
				status = http.StatusNotFound
			}
			s.writeError(w, status, err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
		return
	}
	if strings.HasSuffix(path, "/refund") {
		idStr := strings.TrimSuffix(path, "/refund")
		id, err := parseID(idStr)
		if err != nil {
			s.writeErrorMsg(w, http.StatusBadRequest, "invalid order id")
			return
		}
		if r.Method != http.MethodPost {
			s.methodNotAllowed(w, r)
			return
		}
		var payload struct {
			Amount            float64 `json:"amount"`
			BankCode          string  `json:"bank_code"`
			AccountNumber     string  `json:"account_number"`
			AccountHolderName string  `json:"account_holder_name"`
			Email             string  `json:"email"`
			Notes             string  `json:"notes"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		order, ok := s.Store.GetOrderByID(id)
		if !ok {
			s.writeErrorMsg(w, http.StatusNotFound, "order not found")
			return
		}
		tx, updatedOrder, err := s.createDisbursementForOrder(r.Context(), order, payload.Amount, payload.BankCode, payload.AccountNumber, payload.AccountHolderName, payload.Email, payload.Notes)
		if err != nil {
			s.writeErrorMsg(w, http.StatusBadGateway, err.Error())
			return
		}
		response := map[string]any{
			"transaction": tx,
		}
		if updatedOrder != nil {
			response["order"] = updatedOrder
		}
		s.writeJSON(w, http.StatusCreated, response)
		return
	}
	s.notFound(w)
}

func (s *Server) handleAdminMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	s.writeJSON(w, http.StatusOK, s.Store.ListMessages())
}

func (s *Server) handleAdminPromoCodes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.writeJSON(w, http.StatusOK, s.Store.ListPromoCodes())
	case http.MethodPost:
		var payload struct {
			Code            string  `json:"code"`
			DiscountPercent float64 `json:"discount_percent"`
			MaxUsage        int     `json:"max_usage"`
			ValidFrom       string  `json:"valid_from"`
			ValidUntil      string  `json:"valid_until"`
			Active          *bool   `json:"active"`
			AutoGenerate    bool    `json:"auto_generate"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		code := strings.TrimSpace(payload.Code)
		if payload.AutoGenerate || code == "" {
			generated, err := s.generatePromoCode()
			if err != nil {
				s.writeError(w, http.StatusInternalServerError, err)
				return
			}
			code = generated
		}
		if code == "" {
			s.writeErrorMsg(w, http.StatusBadRequest, "promo code is required")
			return
		}
		if payload.DiscountPercent < 0 {
			payload.DiscountPercent = 0
		}
		if payload.MaxUsage < 0 {
			payload.MaxUsage = 0
		}
		var validFrom time.Time
		var validUntil time.Time
		if strings.TrimSpace(payload.ValidFrom) != "" {
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(payload.ValidFrom))
			if err != nil {
				s.writeErrorMsg(w, http.StatusBadRequest, "invalid valid_from format")
				return
			}
			validFrom = parsed
		}
		if strings.TrimSpace(payload.ValidUntil) != "" {
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(payload.ValidUntil))
			if err != nil {
				s.writeErrorMsg(w, http.StatusBadRequest, "invalid valid_until format")
				return
			}
			validUntil = parsed
		}
		if !validFrom.IsZero() && !validUntil.IsZero() && validUntil.Before(validFrom) {
			s.writeErrorMsg(w, http.StatusBadRequest, "valid_until must be after valid_from")
			return
		}
		active := true
		if payload.Active != nil {
			active = *payload.Active
		}
		promo := &models.PromoCode{
			Code:            code,
			DiscountPercent: payload.DiscountPercent,
			MaxUsage:        payload.MaxUsage,
			ValidFrom:       validFrom,
			ValidUntil:      validUntil,
			Active:          active,
		}
		created, err := s.Store.CreatePromoCode(promo)
		if err != nil {
			status := http.StatusInternalServerError
			msg := err.Error()
			if errors.Is(err, storage.ErrPromoDuplicate) {
				status = http.StatusBadRequest
				msg = "promo code already exists"
			}
			s.writeErrorMsg(w, status, msg)
			return
		}
		s.writeJSON(w, http.StatusCreated, created)
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminPromoCodeByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(strings.TrimPrefix(r.URL.Path, "/api/admin/promocodes/"))
	if err != nil {
		s.writeErrorMsg(w, http.StatusBadRequest, "invalid promo code id")
		return
	}
	switch r.Method {
	case http.MethodPut:
		var payload struct {
			Code            *string  `json:"code"`
			DiscountPercent *float64 `json:"discount_percent"`
			MaxUsage        *int     `json:"max_usage"`
			ValidFrom       *string  `json:"valid_from"`
			ValidUntil      *string  `json:"valid_until"`
			Active          *bool    `json:"active"`
		}
		if err := s.decodeJSON(r.Body, &payload); err != nil {
			s.writeError(w, http.StatusBadRequest, err)
			return
		}
		var update storage.PromoCodeUpdate
		if payload.Code != nil {
			code := strings.TrimSpace(*payload.Code)
			update.Code = &code
		}
		if payload.DiscountPercent != nil {
			value := *payload.DiscountPercent
			update.DiscountPercent = &value
		}
		if payload.MaxUsage != nil {
			value := *payload.MaxUsage
			update.MaxUsage = &value
		}
		if payload.ValidFrom != nil {
			trimmed := strings.TrimSpace(*payload.ValidFrom)
			var t time.Time
			if trimmed != "" {
				parsed, err := time.Parse(time.RFC3339, trimmed)
				if err != nil {
					s.writeErrorMsg(w, http.StatusBadRequest, "invalid valid_from format")
					return
				}
				t = parsed
			}
			update.ValidFrom = &t
		}
		if payload.ValidUntil != nil {
			trimmed := strings.TrimSpace(*payload.ValidUntil)
			var t time.Time
			if trimmed != "" {
				parsed, err := time.Parse(time.RFC3339, trimmed)
				if err != nil {
					s.writeErrorMsg(w, http.StatusBadRequest, "invalid valid_until format")
					return
				}
				t = parsed
			}
			update.ValidUntil = &t
		}
		if payload.Active != nil {
			active := *payload.Active
			update.Active = &active
		}
		updated, err := s.Store.UpdatePromoCode(id, update)
		if err != nil {
			status := http.StatusInternalServerError
			msg := err.Error()
			switch {
			case errors.Is(err, storage.ErrPromoNotFound):
				status = http.StatusNotFound
				msg = "promo code not found"
			case errors.Is(err, storage.ErrPromoDuplicate):
				status = http.StatusBadRequest
				msg = "promo code already exists"
			}
			s.writeErrorMsg(w, status, msg)
			return
		}
		s.writeJSON(w, http.StatusOK, updated)
	case http.MethodDelete:
		if err := s.Store.DeletePromoCode(id); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, storage.ErrPromoNotFound) {
				status = http.StatusNotFound
			}
			s.writeErrorMsg(w, status, err.Error())
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	default:
		s.methodNotAllowed(w, r)
	}
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	services := s.Store.ListServices()
	orders := s.Store.ListOrders()
	messages := s.Store.ListMessages()
	categories := s.Store.ListCategories()

	counts := map[string]int{
		"services":   len(services),
		"orders":     len(orders),
		"messages":   len(messages),
		"categories": len(categories),
	}

	statusSummary := map[string]int{
		"total": len(orders),
	}
	for _, order := range orders {
		statusSummary[order.Status]++
	}

	serviceLookup := make(map[uint]string, len(services))
	for _, svc := range services {
		serviceLookup[svc.ID] = svc.Title
	}

	type recentOrder struct {
		ID            uint      `json:"id"`
		ServiceID     uint      `json:"service_id"`
		ServiceTitle  string    `json:"service_title"`
		CustomerName  string    `json:"customer_name"`
		CustomerEmail string    `json:"customer_email"`
		Status        string    `json:"status"`
		StatusLabel   string    `json:"status_label"`
		Amount        float64   `json:"amount"`
		CreatedAt     time.Time `json:"created_at"`
	}
	const recentLimit = 5
	recent := make([]recentOrder, 0, minInt(len(orders), recentLimit))
	for i, order := range orders {
		if i >= recentLimit {
			break
		}
		customerName := order.CustomerName
		if customerName == "" {
			customerName = order.CustomerEmail
		}
		recent = append(recent, recentOrder{
			ID:            order.ID,
			ServiceID:     order.ServiceID,
			ServiceTitle:  serviceLookup[order.ServiceID],
			CustomerName:  customerName,
			CustomerEmail: order.CustomerEmail,
			Status:        order.Status,
			StatusLabel:   formatStatusLabel(order.Status),
			Amount:        order.Amount,
			CreatedAt:     order.CreatedAt,
		})
	}

	activities := s.Store.ListActivities(30)
	orderActivities := make([]models.Activity, 0, len(activities))
	for _, activity := range activities {
		if strings.EqualFold(activity.Type, "order") {
			orderActivities = append(orderActivities, activity)
		}
	}
	if len(orderActivities) > 10 {
		orderActivities = orderActivities[:10]
	}

	s.writeJSON(w, http.StatusOK, map[string]any{
		"counts":           counts,
		"order_summary":    statusSummary,
		"recent_orders":    recent,
		"activities":       activities,
		"order_activities": orderActivities,
	})
}

func (s *Server) handleAdminAnalyticsSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}

	query := r.URL.Query()
	rangeParam := query.Get("range")
	startParam := query.Get("start")
	endParam := query.Get("end")
	resolution := query.Get("resolution")
	recentLimit := 0
	if raw := strings.TrimSpace(query.Get("recent_limit")); raw != "" {
		if val, err := strconv.Atoi(raw); err == nil && val > 0 {
			recentLimit = val
		}
	}

	start, end := parseAnalyticsRange(rangeParam, startParam, endParam)
	opts := storage.AnalyticsSummaryOptions{
		Start:       start,
		End:         end,
		Resolution:  resolution,
		RecentLimit: recentLimit,
	}
	summary := s.Store.GetAnalyticsSummary(opts)
	s.writeJSON(w, http.StatusOK, summary)
}

func (s *Server) handleAdminAnalyticsEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}

	query := r.URL.Query()
	rangeParam := query.Get("range")
	startParam := query.Get("start")
	endParam := query.Get("end")
	start, end := parseAnalyticsRange(rangeParam, startParam, endParam)

	filter := storage.AnalyticsEventFilter{
		Start:     start,
		End:       end,
		EventType: strings.TrimSpace(query.Get("event_type")),
		SessionID: strings.TrimSpace(query.Get("session_id")),
		VisitorID: strings.TrimSpace(query.Get("visitor_id")),
	}
	if rawLimit := strings.TrimSpace(query.Get("limit")); rawLimit != "" {
		if val, err := strconv.Atoi(rawLimit); err == nil {
			filter.Limit = val
		}
	}

	events := s.Store.ListAnalyticsEvents(filter)
	s.writeJSON(w, http.StatusOK, events)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func formatStatusLabel(status string) string {
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

func parseAnalyticsRange(rangeParam, startParam, endParam string) (time.Time, time.Time) {
	now := time.Now().UTC()
	end := now
	if endParam != "" {
		if parsed, err := parseFlexibleTime(endParam); err == nil {
			end = parsed
		}
	}

	var start time.Time
	if startParam != "" {
		if parsed, err := parseFlexibleTime(startParam); err == nil {
			start = parsed
		}
	}

	if start.IsZero() {
		switch strings.ToLower(strings.TrimSpace(rangeParam)) {
		case "24h", "1d":
			start = end.Add(-24 * time.Hour)
		case "30d":
			start = end.Add(-30 * 24 * time.Hour)
		case "90d":
			start = end.Add(-90 * 24 * time.Hour)
		case "7d", "", "week":
			start = end.Add(-7 * 24 * time.Hour)
		default:
			if dur, err := time.ParseDuration(rangeParam); err == nil {
				start = end.Add(-dur)
			} else {
				start = end.Add(-7 * 24 * time.Hour)
			}
		}
	}

	if start.After(end) {
		start = end.Add(-7 * 24 * time.Hour)
	}
	return start, end
}

func parseFlexibleTime(value string) (time.Time, error) {
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, value); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid time format: %s", value)
}

func clientIPFromRequest(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); ip != "" {
		parts := strings.Split(ip, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if ip := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func guessCountryFromAcceptLanguage(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.Split(header, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if strings.Contains(part, "-") {
			sub := strings.Split(part, "-")
			code := strings.ToUpper(strings.TrimSpace(sub[len(sub)-1]))
			if len(code) == 2 {
				return code
			}
		}
	}
	return ""
}

type galleryFormData struct {
	Item                      *models.GalleryItem
	ExistingAssets            []models.GalleryAsset
	ExistingThumbnail         string
	ExistingAssetsProvided    bool
	ExistingThumbnailProvided bool
	FiltersProvided           bool
}

func getAllFormValuesWithPresence(form *multipart.Form, keys ...string) ([]string, bool) {
	if form == nil {
		return nil, false
	}
	var values []string
	provided := false
	for _, key := range keys {
		if vs, ok := form.Value[key]; ok {
			provided = true
			values = append(values, vs...)
		}
	}
	return values, provided
}

func normalizeGalleryFilters(filters []string) []string {
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

func normalizeGalleryAssetsFromForm(assets []models.GalleryAsset) []models.GalleryAsset {
	if len(assets) == 0 {
		return nil
	}
	out := make([]models.GalleryAsset, 0, len(assets))
	for _, asset := range assets {
		asset.URL = strings.TrimSpace(asset.URL)
		if asset.URL == "" {
			continue
		}
		asset.Caption = strings.TrimSpace(asset.Caption)
		asset.Type = strings.TrimSpace(strings.ToLower(asset.Type))
		switch asset.Type {
		case "pdf":
		case "image":
		default:
			asset.Type = "image"
		}
		out = append(out, asset)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizeGalleryItemFields(item *models.GalleryItem) {
	if item == nil {
		return
	}
	item.Section = strings.TrimSpace(strings.ToLower(item.Section))
	item.Title = strings.TrimSpace(item.Title)
	item.Subtitle = strings.TrimSpace(item.Subtitle)
	item.DisplayMode = strings.TrimSpace(strings.ToLower(item.DisplayMode))
	item.VideoURL = strings.TrimSpace(item.VideoURL)
	item.LinkURL = strings.TrimSpace(item.LinkURL)
	item.Description = strings.TrimSpace(item.Description)
	item.Filters = normalizeGalleryFilters(item.Filters)
}

func convertDriveLinkToPreview(link string) string {
	link = strings.TrimSpace(link)
	if link == "" {
		return ""
	}
	parsed, err := url.Parse(link)
	if err != nil {
		return link
	}
	host := strings.ToLower(parsed.Host)
	if !strings.Contains(host, "drive.google.com") {
		return link
	}
	pathParts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	var fileID string
	for i := 0; i < len(pathParts); i++ {
		part := pathParts[i]
		if part == "file" && i+2 < len(pathParts) && pathParts[i+1] == "d" {
			fileID = pathParts[i+2]
			break
		}
		if part == "d" && i+1 < len(pathParts) {
			fileID = pathParts[i+1]
			break
		}
	}
	if fileID == "" {
		fileID = parsed.Query().Get("id")
	}
	if fileID == "" {
		return link
	}
	return fmt.Sprintf("https://drive.google.com/file/d/%s/preview", fileID)
}

func buildGalleryFilters(items []models.GalleryItem) []string {
	if len(items) == 0 {
		return nil
	}
	filterMap := make(map[string]string)
	for _, item := range items {
		if strings.TrimSpace(strings.ToLower(item.Section)) != "photography" {
			continue
		}
		for _, filter := range item.Filters {
			val := strings.TrimSpace(filter)
			if val == "" {
				continue
			}
			lower := strings.ToLower(val)
			if _, exists := filterMap[lower]; !exists {
				filterMap[lower] = val
			}
		}
	}
	if len(filterMap) == 0 {
		return nil
	}
	filters := make([]string, 0, len(filterMap))
	for _, val := range filterMap {
		filters = append(filters, val)
	}
	sort.Slice(filters, func(i, j int) bool {
		return strings.ToLower(filters[i]) < strings.ToLower(filters[j])
	})
	return filters
}

func validateGalleryItem(item *models.GalleryItem) error {
	if item == nil {
		return errors.New("invalid gallery item")
	}
	normalizeGalleryItemFields(item)
	if item.Section == "" {
		return errors.New("section is required")
	}
	switch item.Section {
	case "photography", "videography", "design", "web":
	default:
		return fmt.Errorf("invalid section %q", item.Section)
	}
	if item.Title == "" {
		return errors.New("title is required")
	}
	if item.Subtitle == "" {
		return errors.New("subtitle is required")
	}
	if item.Thumbnail == "" {
		return errors.New("thumbnail is required")
	}
	switch item.Section {
	case "photography":
		if len(item.Assets) == 0 {
			return errors.New("at least one gallery image is required for photography")
		}
	case "videography":
		if item.VideoURL == "" {
			return errors.New("video url is required for videography")
		}
	case "design":
		if item.DisplayMode == "" {
			item.DisplayMode = "gallery"
		}
		mode := item.DisplayMode
		if mode == "pdf" {
			hasPDF := false
			for _, asset := range item.Assets {
				if asset.Type == "pdf" {
					hasPDF = true
					break
				}
			}
			if !hasPDF {
				return errors.New("design items with PDF mode require at least one PDF asset")
			}
		} else {
			hasImage := false
			for _, asset := range item.Assets {
				if asset.Type != "pdf" {
					hasImage = true
					break
				}
			}
			if !hasImage {
				return errors.New("design gallery mode requires at least one image asset")
			}
			item.DisplayMode = "gallery"
		}
	case "web":
		if item.Description == "" {
			return errors.New("description is required for web items")
		}
	}
	return nil
}

func (s *Server) decodeGalleryForm(form *multipart.Form) (*galleryFormData, error) {
	if form == nil {
		return nil, errors.New("missing form data")
	}
	data := &galleryFormData{
		Item: &models.GalleryItem{},
	}
	data.Item.Section = getFormValue(form, "section")
	data.Item.Title = getFormValue(form, "title")
	data.Item.Subtitle = getFormValue(form, "subtitle")
	data.Item.DisplayMode = getFormValue(form, "display_mode")
	data.Item.VideoURL = getFormValue(form, "video_url")
	data.Item.LinkURL = getFormValue(form, "link_url")
	data.Item.Description = getFormValue(form, "description")
	if filterValues, provided := getAllFormValuesWithPresence(form, "filters", "filters[]"); provided {
		data.FiltersProvided = true
		if len(filterValues) > 0 {
			data.Item.Filters = filterValues
		}
	}
	if rawThumb, ok := form.Value["existing_thumbnail"]; ok {
		data.ExistingThumbnailProvided = true
		if len(rawThumb) > 0 {
			data.ExistingThumbnail = strings.TrimSpace(rawThumb[0])
		}
	}
	if rawAssets, ok := form.Value["existing_assets"]; ok {
		data.ExistingAssetsProvided = true
		if len(rawAssets) > 0 && strings.TrimSpace(rawAssets[0]) != "" {
			if err := json.Unmarshal([]byte(rawAssets[0]), &data.ExistingAssets); err != nil {
				return nil, err
			}
		}
	}
	return data, nil
}

func (s *Server) decodeServiceForm(form *multipart.Form) (*models.Service, error) {
	price, _ := strconv.ParseFloat(getFormValue(form, "price"), 64)
	catID, _ := strconv.Atoi(getFormValue(form, "category_id"))
	title := strings.TrimSpace(getFormValue(form, "title"))
	slug := strings.TrimSpace(getFormValue(form, "slug"))
	summary := strings.TrimSpace(getFormValue(form, "summary"))
	description := strings.TrimSpace(getFormValue(form, "description"))
	var addOns []models.AddOn
	addOnsJSON := getFormValue(form, "addons")
	if addOnsJSON != "" {
		if err := json.Unmarshal([]byte(addOnsJSON), &addOns); err != nil {
			return nil, fmt.Errorf("invalid addons format: %w", err)
		}
	}
	var highlights []models.ServiceHighlight
	highlightsJSON := getFormValue(form, "highlights")
	if highlightsJSON != "" {
		if err := json.Unmarshal([]byte(highlightsJSON), &highlights); err != nil {
			return nil, fmt.Errorf("invalid highlights format: %w", err)
		}
	}
	service := &models.Service{
		Title:         title,
		Slug:          slug,
		Summary:       summary,
		Description:   description,
		Price:         price,
		CategoryID:    uint(catID),
		AddOns:        addOns,
		Highlights:    highlights,
		GalleryImages: []string{},
	}
	return service, nil
}

func (s *Server) wrapCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (s.allowAllOrigins || s.isOriginAllowed(origin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			if s.allowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		} else if origin == "" && s.allowAllOrigins {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if s.allowCredentials {
			w.Header().Add("Vary", "Access-Control-Request-Method")
			w.Header().Add("Vary", "Access-Control-Request-Headers")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) isOriginAllowed(origin string) bool {
	if len(s.allowedOrigins) == 0 {
		return false
	}
	_, ok := s.allowedOrigins[origin]
	return ok
}

func (s *Server) generatePromoCode() (string, error) {
	const attempts = 5
	for i := 0; i < attempts; i++ {
		code, err := buildPromoCode()
		if err != nil {
			return "", err
		}
		if _, ok := s.Store.GetPromoCodeByCode(code); !ok {
			return code, nil
		}
	}
	return "", fmt.Errorf("failed to generate promo code")
}

func buildPromoCode() (string, error) {
	datePart := time.Now().Format("020106")
	mainDigits, err := randomDigits(6)
	if err != nil {
		return "", err
	}
	extraDigits, err := randomDigits(2)
	if err != nil {
		return "", err
	}
	return "DVR" + datePart + mainDigits + extraDigits, nil
}

func randomDigits(length int) (string, error) {
	buf := make([]byte, length)
	for i := range buf {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		buf[i] = byte('0' + n.Int64())
	}
	return string(buf), nil
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			s.writeErrorMsg(w, http.StatusUnauthorized, "missing token")
			return
		}
		token := strings.TrimSpace(authHeader[len("Bearer "):])
		if token == "" {
			s.writeErrorMsg(w, http.StatusUnauthorized, "missing token")
			return
		}

		ctx := r.Context()

		if claims, err := auth.ParseAccessToken(token, s.accessTokenSecret); err == nil {
			ctx = context.WithValue(ctx, ctxKeyPortalRole, portalRoleUser)
			ctx = context.WithValue(ctx, ctxKeyPortalUserID, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if _, err := auth.ValidateToken(token); err == nil {
			ctx = context.WithValue(ctx, ctxKeyPortalRole, portalRoleAdmin)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		s.writeErrorMsg(w, http.StatusUnauthorized, "invalid token")
	})
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return s.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if portalRoleFromContext(r.Context()) != portalRoleAdmin {
			s.writeErrorMsg(w, http.StatusForbidden, "admin approval required")
			return
		}
		next.ServeHTTP(w, r)
	}))
}

func (s *Server) methodNotAllowed(w http.ResponseWriter, r *http.Request) {
	s.writeErrorMsg(w, http.StatusMethodNotAllowed, fmt.Sprintf("%s not allowed", r.Method))
}

func (s *Server) notFound(w http.ResponseWriter) {
	s.writeErrorMsg(w, http.StatusNotFound, "not found")
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	_ = enc.Encode(payload)
}

func (s *Server) writeError(w http.ResponseWriter, status int, err error) {
	s.writeErrorMsg(w, status, err.Error())
}

func (s *Server) writeErrorMsg(w http.ResponseWriter, status int, msg string) {
	s.writeJSON(w, status, map[string]string{"detail": msg})
}

func (s *Server) decodeJSON(body io.ReadCloser, dest any) error {
	defer body.Close()
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dest); err != nil {
		return err
	}
	return nil
}

func getFormValue(form *multipart.Form, key string) string {
	if form == nil {
		return ""
	}
	if values := form.Value[key]; len(values) > 0 {
		return values[0]
	}
	return ""
}

func getFile(form *multipart.Form, key string) *multipart.FileHeader {
	if form == nil {
		return nil
	}
	if files := form.File[key]; len(files) > 0 {
		return files[0]
	}
	return nil
}

func getFiles(form *multipart.Form, key string) []*multipart.FileHeader {
	if form == nil {
		return nil
	}
	if files := form.File[key]; len(files) > 0 {
		return files
	}
	return nil
}

func portalRoleFromContext(ctx context.Context) string {
	if role, ok := ctx.Value(ctxKeyPortalRole).(string); ok {
		return role
	}
	return ""
}

func portalUserIDFromContext(ctx context.Context) uint {
	if id, ok := ctx.Value(ctxKeyPortalUserID).(uint); ok {
		return id
	}
	return 0
}

func parseID(raw string) (uint, error) {
	raw = strings.Trim(raw, "/")
	if raw == "" {
		return 0, errors.New("empty id")
	}
	num, err := strconv.Atoi(raw)
	if err != nil || num <= 0 {
		return 0, errors.New("invalid id")
	}
	return uint(num), nil
}

func (s *Server) createLocalUser(ctx context.Context, email, name, passwordHash string) (*models.User, error) {
	if s.userRepo != nil {
		return s.userRepo.CreateLocalUser(ctx, email, name, passwordHash)
	}
	user, err := s.Store.CreateLocalUser(email, name, passwordHash)
	if err != nil {
		if errors.Is(err, os.ErrExist) {
			return nil, repository.ErrEmailAlreadyUsed
		}
		return nil, err
	}
	return user, nil
}

func (s *Server) upsertOAuthUser(ctx context.Context, email, name, picture, provider, providerID string, loginAt time.Time) (*models.User, error) {
	if s.userRepo != nil {
		return s.userRepo.UpsertOAuthUser(ctx, email, name, picture, provider, providerID, loginAt)
	}
	return s.Store.UpsertOAuthUser(email, name, picture, provider, providerID, loginAt)
}

func (s *Server) findUserByEmail(ctx context.Context, email string) (*models.User, error) {
	if s.userRepo != nil {
		return s.userRepo.FindByEmail(ctx, email)
	}
	user, ok := s.Store.FindUserByEmail(email)
	if !ok {
		return nil, repository.ErrUserNotFound
	}
	return user, nil
}

func (s *Server) recordUserLogin(ctx context.Context, id uint, loginAt time.Time) (*models.User, error) {
	if s.userRepo != nil {
		return s.userRepo.RecordUserLogin(ctx, id, loginAt)
	}
	user, err := s.Store.RecordUserLogin(id, loginAt)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, repository.ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *Server) issueTokens(w http.ResponseWriter, r *http.Request, user *models.User, previousSessionID string) (string, error) {
	ctx := r.Context()
	if previousSessionID != "" {
		_ = s.deleteSession(ctx, previousSessionID)
	}
	now := time.Now().UTC()
	sessionID := uuid.NewString()
	session := &models.Session{
		RefreshTokenID: sessionID,
		UserID:         user.ID,
		UserAgent:      r.UserAgent(),
		IPAddress:      clientIP(r),
		ExpiresAt:      now.Add(s.refreshTokenTTL),
		LastSeenAt:     now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.saveSession(ctx, session); err != nil {
		return "", err
	}
	refreshToken, err := auth.GenerateRefreshToken(sessionID, user.ID, user.Email, s.refreshTokenTTL, s.refreshTokenSecret)
	if err != nil {
		return "", err
	}
	s.setSessionCookie(w, refreshToken, session.ExpiresAt)
	accessToken, err := auth.GenerateAccessToken(user.ID, user.Email, s.accessTokenTTL, s.accessTokenSecret)
	if err != nil {
		return "", err
	}
	return accessToken, nil
}

func (s *Server) accessTokenFromRequest(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return ""
}

func (s *Server) readRefreshToken(r *http.Request) (*auth.RefreshClaims, string, error) {
	if s.sessionCookieName == "" {
		s.sessionCookieName = defaultSessionCookieName
	}
	cookie, err := r.Cookie(s.sessionCookieName)
	if err != nil {
		return nil, "", err
	}
	token := strings.TrimSpace(cookie.Value)
	if token == "" {
		return nil, "", errors.New("empty refresh token")
	}
	claims, err := auth.ParseRefreshToken(token, s.refreshTokenSecret)
	if err != nil {
		return nil, "", err
	}
	return claims, token, nil
}

func (s *Server) parseRefreshSession(ctx context.Context, r *http.Request) (*auth.RefreshClaims, *models.Session, *models.User, error) {
	claims, _, err := s.readRefreshToken(r)
	if err != nil {
		return nil, nil, nil, err
	}
	session, err := s.getSession(ctx, claims.SessionID)
	if err != nil {
		return nil, nil, nil, err
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		_ = s.deleteSession(ctx, claims.SessionID)
		return nil, nil, nil, errors.New("session expired")
	}
	if s.sessionRepo != nil {
		_ = s.sessionRepo.UpdateLastSeen(ctx, claims.SessionID, time.Now().UTC())
	} else {
		s.sessionMu.Lock()
		if stored, ok := s.localSessions[claims.SessionID]; ok {
			stored.LastSeenAt = time.Now().UTC()
		}
		s.sessionMu.Unlock()
	}
	user, err := s.findUserByEmail(ctx, claims.Email)
	if err != nil {
		return nil, nil, nil, err
	}
	if session.UserID != user.ID {
		return nil, nil, nil, errors.New("session user mismatch")
	}
	return claims, session, user, nil
}

func (s *Server) resolveUser(w http.ResponseWriter, r *http.Request) (string, *models.User, error) {
	if token := s.accessTokenFromRequest(r); token != "" {
		claims, err := auth.ParseAccessToken(token, s.accessTokenSecret)
		if err != nil {
			return "", nil, err
		}
		user, err := s.findUserByEmail(r.Context(), claims.Email)
		if err != nil {
			return "", nil, err
		}
		return token, user, nil
	}
	_, session, user, err := s.parseRefreshSession(r.Context(), r)
	if err != nil {
		return "", nil, err
	}
	accessToken, err := s.issueTokens(w, r, user, session.RefreshTokenID)
	if err != nil {
		return "", nil, err
	}
	return accessToken, user, nil
}

func (s *Server) saveSession(ctx context.Context, session *models.Session) error {
	if s.sessionRepo != nil {
		return s.sessionRepo.Create(ctx, session)
	}
	s.sessionMu.Lock()
	s.localSessions[session.RefreshTokenID] = session
	s.sessionMu.Unlock()
	return nil
}

func (s *Server) getSession(ctx context.Context, tokenID string) (*models.Session, error) {
	if s.sessionRepo != nil {
		return s.sessionRepo.Get(ctx, tokenID)
	}
	s.sessionMu.RLock()
	session, ok := s.localSessions[tokenID]
	s.sessionMu.RUnlock()
	if !ok {
		return nil, repository.ErrSessionNotFound
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		s.sessionMu.Lock()
		delete(s.localSessions, tokenID)
		s.sessionMu.Unlock()
		return nil, repository.ErrSessionNotFound
	}
	return session, nil
}

func (s *Server) deleteSession(ctx context.Context, tokenID string) error {
	if s.sessionRepo != nil {
		return s.sessionRepo.Delete(ctx, tokenID)
	}
	s.sessionMu.Lock()
	delete(s.localSessions, tokenID)
	s.sessionMu.Unlock()
	return nil
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	claims, session, user, err := s.parseRefreshSession(r.Context(), r)
	if err != nil {
		s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	if session.RefreshTokenID != claims.SessionID {
		s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	accessToken, err := s.issueTokens(w, r, user, session.RefreshTokenID)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.writeJSON(w, http.StatusOK, s.newAuthResponse(accessToken, user))
}

func clientIP(r *http.Request) string {
	xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	ip, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return ip
}
func (s *Server) deleteStaticFile(publicPath string) {
	if !strings.HasPrefix(publicPath, "/api/static/") {
		return
	}
	rel := strings.TrimPrefix(publicPath, "/api/static/")
	if rel == "" {
		return
	}
	abs := filepath.Join(s.UploadDir, filepath.FromSlash(rel))
	_ = os.Remove(abs)
}

func (s *Server) recordPaymentChannelAvailability(category, channel string, available bool, message string) {
	if s.Store == nil {
		return
	}
	normalizedCategory := strings.ToUpper(strings.TrimSpace(category))
	normalizedChannel := strings.ToUpper(strings.TrimSpace(channel))
	if normalizedCategory == "" {
		return
	}
	if normalizedChannel == "" {
		normalizedChannel = normalizedCategory
	}
	status, changed, err := s.Store.SetPaymentChannelStatus(normalizedCategory, normalizedChannel, available, message)
	if err != nil {
		log.Printf("failed to update payment channel status %s/%s: %v", normalizedCategory, normalizedChannel, err)
		return
	}
	if changed {
		state := "available"
		if !available {
			state = "unavailable"
		}
		logMessage := strings.TrimSpace(message)
		if logMessage != "" {
			log.Printf("payment channel %s/%s is now %s: %s", normalizedCategory, normalizedChannel, state, logMessage)
		} else {
			log.Printf("payment channel %s/%s is now %s", normalizedCategory, normalizedChannel, state)
		}
	} else if status != nil && !available {
		trimmed := strings.TrimSpace(message)
		if trimmed != "" {
			log.Printf("payment channel %s/%s remains unavailable: %s", normalizedCategory, normalizedChannel, trimmed)
		}
	}
}

func parseXenditError(body []byte) (string, string) {
	if len(body) == 0 {
		return "", ""
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return strings.TrimSpace(string(body)), ""
	}
	message := strings.TrimSpace(stringFromAny(payload["message"]))
	errorCode := strings.TrimSpace(stringFromAny(payload["error_code"]))
	if message == "" {
		if errorsArray, ok := payload["errors"].([]any); ok {
			for _, item := range errorsArray {
				if entry, ok := item.(map[string]any); ok {
					if msg := strings.TrimSpace(stringFromAny(entry["message"])); msg != "" {
						message = msg
						break
					}
				}
			}
		}
	}
	if message == "" {
		message = strings.TrimSpace(string(body))
	}
	return message, errorCode
}

func shouldDisablePaymentChannel(statusCode int, callErr error, message, errorCode string) bool {
	if callErr != nil {
		return true
	}
	if statusCode == 0 {
		return true
	}
	if statusCode >= http.StatusInternalServerError {
		return true
	}
	if statusCode == http.StatusRequestTimeout || statusCode == http.StatusGatewayTimeout {
		return true
	}
	upperMessage := strings.ToUpper(strings.TrimSpace(message))
	upperCode := strings.ToUpper(strings.TrimSpace(errorCode))
	keywords := []string{"UNAVAILABLE", "DISABLED", "MAINTENANCE", "DOWN", "TIMEOUT", "BLOCKED"}
	for _, keyword := range keywords {
		if strings.Contains(upperMessage, keyword) || strings.Contains(upperCode, keyword) {
			return true
		}
	}
	return false
}

func (s *Server) handleXenditCallError(category, channel, operation string, statusCode int, body []byte, callErr error) error {
	if callErr != nil {
		message := strings.TrimSpace(callErr.Error())
		if message == "" {
			message = "xendit request failed"
		}
		if shouldDisablePaymentChannel(statusCode, callErr, message, "") {
			s.recordPaymentChannelAvailability(category, channel, false, message)
		}
		return fmt.Errorf("%s: %w", operation, callErr)
	}
	message, errorCode := parseXenditError(body)
	if message == "" {
		message = fmt.Sprintf("xendit returned status %d", statusCode)
	}
	if shouldDisablePaymentChannel(statusCode, nil, message, errorCode) {
		s.recordPaymentChannelAvailability(category, channel, false, message)
	}
	return fmt.Errorf("%s: %s", operation, message)
}

func (s *Server) callXendit(ctx context.Context, method, endpoint string, payload []byte) ([]byte, int, error) {
	if strings.TrimSpace(s.xenditAPIKey) == "" {
		return nil, 0, errors.New("xendit api key not configured")
	}
	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}
	client := s.httpClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, method, s.xenditBaseURL+endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(s.xenditAPIKey, "")
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return body, resp.StatusCode, nil
}

func stringFromAny(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	case json.Number:
		return v.String()
	default:
		return ""
	}
}

func floatFromAny(value any) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint64:
		return float64(v), true
	case json.Number:
		f, err := v.Float64()
		if err == nil {
			return f, true
		}
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, false
		}
		if f, err := strconv.ParseFloat(trimmed, 64); err == nil {
			return f, true
		}
	}
	return 0, false
}

func timeFromPayload(data map[string]any, keys ...string) (time.Time, bool) {
	if data == nil {
		return time.Time{}, false
	}
	for _, key := range keys {
		raw, ok := data[key]
		if !ok {
			continue
		}
		if str := stringFromAny(raw); str != "" {
			if ts, err := time.Parse(time.RFC3339, str); err == nil {
				return ts, true
			}
		}
	}
	return time.Time{}, false
}

func (s *Server) setSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	if s.sessionCookieName == "" {
		s.sessionCookieName = defaultSessionCookieName
	}
	cookie := &http.Cookie{
		Name:     s.sessionCookieName,
		Value:    token,
		HttpOnly: true,
		Path:     "/",
		Secure:   s.sessionCookieSecure,
		SameSite: s.sessionCookieSameSite,
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
	}
	if s.sessionCookieDomain != "" {
		cookie.Domain = s.sessionCookieDomain
	}
	http.SetCookie(w, cookie)
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	if s.sessionCookieName == "" {
		s.sessionCookieName = defaultSessionCookieName
	}
	cookie := &http.Cookie{
		Name:     s.sessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   s.sessionCookieDomain,
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		Secure:   s.sessionCookieSecure,
		SameSite: s.sessionCookieSameSite,
	}
	http.SetCookie(w, cookie)
}

func (s *Server) attachOAuthUser(ctx context.Context, user *models.User, userInfo *googleUserInfo, provider, providerID string, at time.Time) (*models.User, error) {
	if s.userRepo != nil {
		return s.userRepo.AttachOAuthProvider(ctx, user.ID, userInfo.Email, userInfo.Name, userInfo.Picture, provider, providerID, at)
	}
	return nil, errors.New("user repository not available for linking accounts")
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	_, user, err := s.resolveUser(w, r)
	if err != nil {
		s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	if s.userRepo == nil {
		s.writeErrorMsg(w, http.StatusNotImplemented, "not implemented")
		return
	}

	providers, err := s.userRepo.ListAuthProviders(r.Context(), user.ID)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.writeJSON(w, http.StatusOK, providers)
}

func (s *Server) handleLinkGoogleAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.methodNotAllowed(w, r)
		return
	}
	if s.googleOAuthConfig == nil {
		s.writeErrorMsg(w, http.StatusServiceUnavailable, "google oauth not configured")
		return
	}
	_, _, err := s.resolveUser(w, r)
	if err != nil {
		s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	state, err := s.buildOAuthState("/account", "link", "google")
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}
	authURL := s.googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOnline, oauth2.SetAuthURLParam("prompt", "select_account"))
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (s *Server) handleUnlinkGoogleAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.methodNotAllowed(w, r)
		return
	}
	_, user, err := s.resolveUser(w, r)
	if err != nil {
		s.writeErrorMsg(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	if s.userRepo == nil {
		s.writeErrorMsg(w, http.StatusNotImplemented, "not implemented")
		return
	}

	if err := s.userRepo.DetachOAuthProvider(r.Context(), user.ID, "google"); err != nil {
		s.writeError(w, http.StatusInternalServerError, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
