package models

import (
	"encoding/json"
	"time"
)

type AddOn struct {
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type ServiceHighlight struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type Category struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type Service struct {
	ID            uint               `json:"id"`
	Title         string             `json:"title"`
	Slug          string             `json:"slug"`
	Price         float64            `json:"price"`
	CategoryID    uint               `json:"category_id"`
	Thumbnail     string             `json:"thumbnail"`
	Summary       string             `json:"summary"`
	Description   string             `json:"description"`
	GalleryImages []string           `json:"gallery_images"`
	AddOns        []AddOn            `json:"add_ons"`
	Highlights    []ServiceHighlight `json:"highlights"`
}

type GalleryAsset struct {
	URL     string `json:"url"`
	Caption string `json:"caption,omitempty"`
	Type    string `json:"type"`
}

type GalleryItem struct {
	ID          uint           `json:"id"`
	Section     string         `json:"section"`
	Title       string         `json:"title"`
	Subtitle    string         `json:"subtitle"`
	Thumbnail   string         `json:"thumbnail"`
	Filters     []string       `json:"filters,omitempty"`
	DisplayMode string         `json:"display_mode,omitempty"`
	Assets      []GalleryAsset `json:"assets,omitempty"`
	VideoURL    string         `json:"video_url,omitempty"`
	LinkURL     string         `json:"link_url,omitempty"`
	Description string         `json:"description,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type Experience struct {
	ID          uint      `json:"id"`
	Period      string    `json:"period"`
	Title       string    `json:"title"`
	Company     string    `json:"company,omitempty"`
	Description string    `json:"description"`
	Order       int       `json:"order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Order struct {
	ID                   uint      `json:"id"`
	ServiceID            uint      `json:"service_id"`
	CustomerName         string    `json:"customer_name"`
	CustomerEmail        string    `json:"customer_email"`
	CustomerPhone        string    `json:"customer_phone"`
	Notes                string    `json:"notes"`
	Status               string    `json:"status"`
	CancelReason         string    `json:"cancel_reason,omitempty"`
	Amount               float64   `json:"amount"`
	PromoCode            string    `json:"promo_code,omitempty"`
	PromoDiscountPercent float64   `json:"promo_discount_percent,omitempty"`
	PromoDiscountAmount  float64   `json:"promo_discount_amount,omitempty"`
	PaymentMethod        string    `json:"payment_method,omitempty"`
	PaymentStatus        string    `json:"payment_status,omitempty"`
	PaymentReference     string    `json:"payment_reference,omitempty"`
	PaymentExpiresAt     time.Time `json:"payment_expires_at,omitempty"`
	RequestReason        string    `json:"request_reason,omitempty"`
	RefundStatus         string    `json:"refund_status,omitempty"`
	RatingValue          int       `json:"rating_value,omitempty"`
	RatingReview         string    `json:"rating_review,omitempty"`
	RatedAt              time.Time `json:"rated_at,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type PaymentTransaction struct {
	ID                   uint            `json:"id"`
	OrderID              uint            `json:"order_id"`
	Method               string          `json:"method"`
	Channel              string          `json:"channel,omitempty"`
	Status               string          `json:"status"`
	Amount               float64         `json:"amount"`
	Currency             string          `json:"currency,omitempty"`
	Reference            string          `json:"reference"`
	ExternalID           string          `json:"external_id,omitempty"`
	XenditID             string          `json:"xendit_id"`
	InvoiceURL           string          `json:"invoice_url,omitempty"`
	CheckoutURL          string          `json:"checkout_url,omitempty"`
	QRCodeURL            string          `json:"qr_code_url,omitempty"`
	QRString             string          `json:"qr_string,omitempty"`
	VirtualAccountNumber string          `json:"virtual_account_number,omitempty"`
	BankCode             string          `json:"bank_code,omitempty"`
	PaymentCode          string          `json:"payment_code,omitempty"`
	ExpiresAt            time.Time       `json:"expires_at,omitempty"`
	RawResponse          json.RawMessage `json:"raw_response,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

type PaymentChannelStatus struct {
	Category  string    `json:"category"`
	Channel   string    `json:"channel"`
	Available bool      `json:"available"`
	Message   string    `json:"message,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PromoCode struct {
	ID              uint      `json:"id"`
	Code            string    `json:"code"`
	DiscountPercent float64   `json:"discount_percent"`
	MaxUsage        int       `json:"max_usage"`
	UsedCount       int       `json:"used_count"`
	ValidFrom       time.Time `json:"valid_from,omitempty"`
	ValidUntil      time.Time `json:"valid_until,omitempty"`
	Active          bool      `json:"active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Message struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Subject   string    `json:"subject"`
	Body      string    `json:"message"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Admin struct {
	ID           uint   `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
}

type User struct {
	ID           uint      `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	Picture      string    `json:"picture,omitempty"`
	Provider     string    `json:"provider"`
	ProviderID   string    `json:"provider_id"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	LastLogin    time.Time `json:"last_login_at"`
}

type AuthProvider struct {
	Provider   string    `json:"provider"`
	ProviderID string    `json:"provider_id"`
	Email      string    `json:"email,omitempty"`
	LinkedAt   time.Time `json:"linked_at"`
}

type Session struct {
	RefreshTokenID string    `json:"refresh_token_id"`
	UserID         uint      `json:"user_id"`
	UserAgent      string    `json:"user_agent,omitempty"`
	IPAddress      string    `json:"ip_address,omitempty"`
	ExpiresAt      time.Time `json:"expires_at"`
	LastSeenAt     time.Time `json:"last_seen_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Activity struct {
	ID          uint              `json:"id"`
	Type        string            `json:"type"`
	Action      string            `json:"action"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	ReferenceID uint              `json:"reference_id,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
}

type AnalyticsEvent struct {
	ID          uint              `json:"id"`
	SessionID   string            `json:"session_id"`
	VisitorID   string            `json:"visitor_id"`
	EventType   string            `json:"event_type"`
	EventName   string            `json:"event_name"`
	PagePath    string            `json:"page_path"`
	PageTitle   string            `json:"page_title,omitempty"`
	Referrer    string            `json:"referrer,omitempty"`
	Country     string            `json:"country,omitempty"`
	City        string            `json:"city,omitempty"`
	Device      string            `json:"device,omitempty"`
	Browser     string            `json:"browser,omitempty"`
	OS          string            `json:"os,omitempty"`
	UTMSource   string            `json:"utm_source,omitempty"`
	UTMMedium   string            `json:"utm_medium,omitempty"`
	UTMCampaign string            `json:"utm_campaign,omitempty"`
	UTMTerm     string            `json:"utm_term,omitempty"`
	UTMContent  string            `json:"utm_content,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	OccurredAt  time.Time         `json:"occurred_at"`
}

type AnalyticsTrafficSource struct {
	Source   string `json:"source,omitempty"`
	Medium   string `json:"medium,omitempty"`
	Campaign string `json:"campaign,omitempty"`
	Term     string `json:"term,omitempty"`
	Content  string `json:"content,omitempty"`
}

type AnalyticsSession struct {
	ID           uint                   `json:"id"`
	SessionID    string                 `json:"session_id"`
	VisitorID    string                 `json:"visitor_id"`
	FirstSeen    time.Time              `json:"first_seen"`
	LastSeen     time.Time              `json:"last_seen"`
	Referrer     string                 `json:"referrer,omitempty"`
	Country      string                 `json:"country,omitempty"`
	Traffic      AnalyticsTrafficSource `json:"traffic_source"`
	PageViews    int                    `json:"page_views"`
	EventCount   int                    `json:"event_count"`
	PageSequence []string               `json:"page_sequence,omitempty"`
}
