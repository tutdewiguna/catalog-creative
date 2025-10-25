package utils

import (
	"bytes"
	"fmt"
	"html/template"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"devara-creative-backend/app/models"
)

type EmailBranding struct {
	Name         string
	PrimaryColor string
	AccentColor  string
	LightColor   string
	DarkColor    string
	SupportEmail string
	WebsiteURL   string
}

type EmailHighlight struct {
	Label       string
	Value       string
	Description string
}

type EmailSummaryItem struct {
	Label string
	Value string
}

type EmailLineItem struct {
	Title       string
	Description string
	Quantity    string
	Amount      string
}

type EmailButton struct {
	Label string
	URL   string
}

type EmailTemplateData struct {
	Preheader            string
	Title                string
	Greeting             string
	IntroParagraphs      []string
	BodyParagraphs       []string
	AdditionalParagraphs []string
	SummaryTitle         string
	SummaryItems         []EmailSummaryItem
	LineItems            []EmailLineItem
	Highlight            *EmailHighlight
	Button               *EmailButton
	FooterNote           string
	Timestamp            time.Time
	Brand                EmailBranding
}

var (
	emailTemplateOnce sync.Once
	emailTemplate     *template.Template
	emailTemplateErr  error
)

const emailLayoutTemplate = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{{.Title}}</title>
<style>
:root { color-scheme: light; }
body { margin:0; padding:0; background-color:#f5f7fb; font-family:'Inter', 'Poppins', 'Segoe UI', Helvetica, Arial, sans-serif; color:#1f2933; }
a { color: {{.Brand.PrimaryColor}}; }
.email-wrapper { width:100%; background: linear-gradient(135deg, rgba(11,37,69,0.08), rgba(199,166,69,0.08)); padding:32px 0; }
.email-container { max-width:640px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 18px 45px rgba(11,37,69,0.12); border:1px solid rgba(11,37,69,0.08); }
.header { background: linear-gradient(120deg, {{.Brand.AccentColor}}, {{.Brand.DarkColor}}); padding:40px 36px; color:#ffffff; }
.brand-badge { display:inline-block; padding:8px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.4); letter-spacing:0.16em; font-size:12px; text-transform:uppercase; }
.header-title { font-size:26px; font-weight:600; margin-top:16px; letter-spacing:0.05em; text-transform:uppercase; }
.content { padding:36px; }
.greeting { font-size:18px; font-weight:600; color:{{.Brand.AccentColor}}; margin:0 0 12px; }
.paragraph { font-size:15px; line-height:1.8; margin:0 0 18px; }
.highlight { border-radius:22px; border:1px solid rgba(199,166,69,0.45); background: rgba(199,166,69,0.12); padding:24px; text-align:center; margin:24px 0; }
.highlight-label { font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:{{.Brand.AccentColor}}; margin-bottom:8px; }
.highlight-value { font-size:34px; font-weight:700; color:{{.Brand.PrimaryColor}}; letter-spacing:0.22em; }
.highlight-desc { font-size:14px; color:#374151; margin-top:12px; }
.summary { margin:24px 0; border-radius:20px; border:1px solid rgba(11,37,69,0.08); overflow:hidden; }
.summary-title { padding:16px 22px; background:rgba(11,37,69,0.05); font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:{{.Brand.AccentColor}}; font-weight:600; }
.summary-table { width:100%; border-collapse:collapse; }
.summary-table td { padding:14px 22px; font-size:14px; border-top:1px solid rgba(11,37,69,0.06); color:#374151; vertical-align:top; }
.summary-table td:first-child { width:42%; font-weight:600; color:{{.Brand.AccentColor}}; }
.line-items { margin:24px 0; border-radius:20px; border:1px solid rgba(11,37,69,0.08); border-collapse:collapse; width:100%; overflow:hidden; }
.line-items thead th { background:rgba(11,37,69,0.05); padding:14px 18px; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:{{.Brand.AccentColor}}; text-align:left; }
.line-items tbody td { padding:16px 18px; font-size:14px; border-top:1px solid rgba(11,37,69,0.06); color:#374151; }
.line-items tbody td.amount { text-align:right; font-weight:600; color:{{.Brand.PrimaryColor}}; }
.cta { margin:32px 0; text-align:center; }
.cta a { display:inline-block; padding:15px 36px; border-radius:999px; background:{{.Brand.PrimaryColor}}; color:{{.Brand.DarkColor}} !important; font-weight:600; letter-spacing:0.08em; text-decoration:none; box-shadow:0 16px 34px rgba(199,166,69,0.32); }
.cta a:hover { opacity:0.96; }
.additional { font-size:13px; color:#6b7280; line-height:1.7; margin:0 0 12px; }
.footer { background:{{.Brand.DarkColor}}; color:rgba(255,255,255,0.85); padding:28px 36px; font-size:13px; line-height:1.7; }
.footer a { color:{{.Brand.PrimaryColor}}; font-weight:600; text-decoration:none; }
.footer-note { margin:0 0 10px; }
.footer-meta { margin:0; font-size:12px; color:rgba(255,255,255,0.72); }
.preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; }
@media (max-width: 620px) {
  .email-wrapper { padding:18px; }
  .header { padding:32px 24px; }
  .content { padding:28px 22px; }
}
</style>
</head>
<body>
<span class="preheader">{{.Preheader}}</span>
<div class="email-wrapper">
  <div class="email-container">
    <div class="header">
      <span class="brand-badge">{{.Brand.Name}}</span>
      <div class="header-title">{{.Title}}</div>
    </div>
    <div class="content">
      {{if .Greeting}}<p class="greeting">{{.Greeting}}</p>{{end}}
      {{range .IntroParagraphs}}<p class="paragraph">{{.}}</p>{{end}}
      {{if .Highlight}}
      <div class="highlight">
        {{if .Highlight.Label}}<div class="highlight-label">{{.Highlight.Label}}</div>{{end}}
        <div class="highlight-value">{{.Highlight.Value}}</div>
        {{if .Highlight.Description}}<div class="highlight-desc">{{.Highlight.Description}}</div>{{end}}
      </div>
      {{end}}
      {{range .BodyParagraphs}}<p class="paragraph">{{.}}</p>{{end}}
      {{if .SummaryItems}}
      <div class="summary">
        {{if .SummaryTitle}}<div class="summary-title">{{.SummaryTitle}}</div>{{end}}
        <table class="summary-table" role="presentation">
          <tbody>
            {{range .SummaryItems}}<tr><td>{{.Label}}</td><td>{{.Value}}</td></tr>{{end}}
          </tbody>
        </table>
      </div>
      {{end}}
      {{if .LineItems}}
      <table class="line-items" role="presentation">
        <thead><tr><th>Item</th><th>Kuantitas</th><th class="amount">Total</th></tr></thead>
        <tbody>
          {{range .LineItems}}<tr>
            <td><strong>{{.Title}}</strong>{{if .Description}}<div style="margin-top:6px; font-size:12px; color:#6b7280;">{{.Description}}</div>{{end}}</td>
            <td>{{.Quantity}}</td>
            <td class="amount">{{.Amount}}</td>
          </tr>{{end}}
        </tbody>
      </table>
      {{end}}
      {{if .Button}}
      <div class="cta"><a href="{{.Button.URL}}" target="_blank" rel="noopener">{{.Button.Label}}</a></div>
      {{end}}
      {{range .AdditionalParagraphs}}<p class="additional">{{.}}</p>{{end}}
    </div>
    <div class="footer">
      {{if .FooterNote}}<p class="footer-note">{{.FooterNote}}</p>{{end}}
      <p class="footer-meta">Butuh bantuan? Hubungi kami di <a href="mailto:{{.Brand.SupportEmail}}">{{.Brand.SupportEmail}}</a>{{if .Brand.WebsiteURL}} atau kunjungi <a href="{{.Brand.WebsiteURL}}">{{.Brand.WebsiteURL}}</a>{{end}}.</p>
      <p class="footer-meta">© {{.Timestamp.Year}} {{.Brand.Name}}. All rights reserved.</p>
    </div>
  </div>
</div>
</body>
</html>`

func RenderEmailTemplate(data EmailTemplateData) (string, string, error) {
	if data.Timestamp.IsZero() {
		data.Timestamp = time.Now()
	}
	data.Brand = getEmailBranding()
	if data.Preheader == "" {
		data.Preheader = data.Title
	}
	emailTemplateOnce.Do(func() {
		emailTemplate, emailTemplateErr = template.New("branded-email").Parse(emailLayoutTemplate)
	})
	if emailTemplateErr != nil {
		return "", "", emailTemplateErr
	}
	var htmlBuffer bytes.Buffer
	if err := emailTemplate.Execute(&htmlBuffer, data); err != nil {
		return "", "", err
	}
	textBody := buildPlainTextEmail(data)
	return htmlBuffer.String(), textBody, nil
}

func BuildOTPEmail(name, otp string, expiresIn time.Duration) (string, string, string, error) {
	branding := getEmailBranding()
	trimmedOTP := strings.TrimSpace(otp)
	spacedOTP := formatOTP(trimmedOTP)
	expirationText := "Kode berlaku selama 10 menit."
	if expiresIn > 0 {
		minutes := int(math.Ceil(expiresIn.Minutes()))
		if minutes <= 1 {
			expirationText = "Kode berlaku kurang dari 1 menit."
		} else {
			expirationText = fmt.Sprintf("Kode berlaku selama %d menit.", minutes)
		}
	}
	greeting := "Halo,"
	if strings.TrimSpace(name) != "" {
		greeting = fmt.Sprintf("Halo %s,", strings.TrimSpace(name))
	}
	data := EmailTemplateData{
		Preheader:       fmt.Sprintf("Gunakan kode OTP %s untuk verifikasi akun Anda", trimmedOTP),
		Title:           "Kode Verifikasi Keamanan",
		Greeting:        greeting,
		IntroParagraphs: []string{"Kami menerima permintaan untuk memverifikasi akun Anda di " + branding.Name + "."},
		Highlight: &EmailHighlight{
			Label:       "Kode OTP",
			Value:       spacedOTP,
			Description: expirationText,
		},
		BodyParagraphs: []string{
			"Masukkan kode di atas pada layar verifikasi untuk melanjutkan proses.",
		},
		AdditionalParagraphs: []string{
			"Jika Anda tidak melakukan permintaan ini, abaikan email ini atau hubungi tim kami sehingga kami dapat membantu Anda menjaga keamanan akun.",
		},
		FooterNote: fmt.Sprintf("Email ini dikirim otomatis oleh %s.", branding.Name),
	}
	htmlBody, textBody, err := RenderEmailTemplate(data)
	if err != nil {
		return "", "", "", err
	}
	subject := fmt.Sprintf("%s • Kode OTP Verifikasi", branding.Name)
	return subject, htmlBody, textBody, nil
}

func BuildOrderConfirmationEmail(order *models.Order, service *models.Service, paymentURL string) (string, string, string, error) {
	if order == nil {
		return "", "", "", fmt.Errorf("order is required")
	}
	branding := getEmailBranding()
	greeting := fmt.Sprintf("Halo %s,", strings.TrimSpace(order.CustomerName))
	if strings.TrimSpace(order.CustomerName) == "" {
		greeting = "Halo,"
	}
	serviceTitle := "Layanan"
	if service != nil && strings.TrimSpace(service.Title) != "" {
		serviceTitle = service.Title
	}
	summaryItems := []EmailSummaryItem{
		{Label: "Nomor Pesanan", Value: fmt.Sprintf("#%d", order.ID)},
		{Label: "Layanan", Value: serviceTitle},
		{Label: "Status", Value: humanizeOrderStatus(order.Status)},
	}
	if strings.TrimSpace(order.PaymentMethod) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Metode Pembayaran", Value: humanizePaymentMethod(order.PaymentMethod)})
	}
	if strings.TrimSpace(order.PaymentStatus) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Status Pembayaran", Value: humanizePaymentStatus(order.PaymentStatus)})
	}
	if !order.PaymentExpiresAt.IsZero() {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Batas Pembayaran", Value: formatDate(order.PaymentExpiresAt)})
	}
	if strings.TrimSpace(order.Notes) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Catatan", Value: order.Notes})
	}
	lineItems := []EmailLineItem{{
		Title:    serviceTitle,
		Quantity: "1",
		Amount:   formatCurrencyIDR(order.Amount),
	}}
	data := EmailTemplateData{
		Preheader:       fmt.Sprintf("Pesanan #%d berhasil kami terima", order.ID),
		Title:           "Konfirmasi Pesanan",
		Greeting:        greeting,
		IntroParagraphs: []string{"Terima kasih telah memilih " + branding.Name + ". Pesanan Anda sudah kami terima dan sedang kami proses."},
		Highlight: &EmailHighlight{
			Label: "Total Pembayaran",
			Value: formatCurrencyIDR(order.Amount),
		},
		SummaryTitle: "Ringkasan Pesanan",
		SummaryItems: summaryItems,
		LineItems:    lineItems,
		BodyParagraphs: []string{
			"Tim kami akan segera menghubungi Anda untuk tahap berikutnya dan memastikan seluruh kebutuhan Anda terpenuhi.",
		},
		AdditionalParagraphs: []string{
			"Jika Anda memerlukan penyesuaian atau informasi tambahan, balas email ini atau hubungi tim kami kapan saja.",
		},
		FooterNote: fmt.Sprintf("Email ini dikirim otomatis oleh %s.", branding.Name),
	}
	if strings.TrimSpace(paymentURL) != "" {
		data.Button = &EmailButton{Label: "Lihat Detail Pembayaran", URL: paymentURL}
	}
	htmlBody, textBody, err := RenderEmailTemplate(data)
	if err != nil {
		return "", "", "", err
	}
	subject := fmt.Sprintf("Konfirmasi Pesanan #%d • %s", order.ID, branding.Name)
	return subject, htmlBody, textBody, nil
}

func BuildOrderStatusEmail(order *models.Order, service *models.Service, customMessage string) (string, string, string, error) {
	if order == nil {
		return "", "", "", fmt.Errorf("order is required")
	}
	branding := getEmailBranding()
	greeting := fmt.Sprintf("Halo %s,", strings.TrimSpace(order.CustomerName))
	if strings.TrimSpace(order.CustomerName) == "" {
		greeting = "Halo,"
	}
	serviceTitle := "Layanan"
	if service != nil && strings.TrimSpace(service.Title) != "" {
		serviceTitle = service.Title
	}
	summaryItems := []EmailSummaryItem{
		{Label: "Nomor Pesanan", Value: fmt.Sprintf("#%d", order.ID)},
		{Label: "Layanan", Value: serviceTitle},
		{Label: "Status Terbaru", Value: humanizeOrderStatus(order.Status)},
	}
	if strings.TrimSpace(order.PaymentStatus) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Status Pembayaran", Value: humanizePaymentStatus(order.PaymentStatus)})
	}
	if strings.TrimSpace(order.PaymentMethod) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Metode Pembayaran", Value: humanizePaymentMethod(order.PaymentMethod)})
	}
	if strings.TrimSpace(customMessage) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Catatan", Value: customMessage})
	}
	data := EmailTemplateData{
		Preheader:       fmt.Sprintf("Update terbaru untuk pesanan #%d", order.ID),
		Title:           "Status Pesanan Diperbarui",
		Greeting:        greeting,
		IntroParagraphs: []string{"Kami ingin memberi tahu Anda bahwa status pesanan Anda telah diperbarui."},
		SummaryTitle:    "Detail Pembaruan",
		SummaryItems:    summaryItems,
		BodyParagraphs: []string{
			"Silakan cek detail di atas. Jika Anda membutuhkan bantuan tambahan, kami siap membantu kapan saja.",
		},
		FooterNote: fmt.Sprintf("Email ini dikirim otomatis oleh %s.", branding.Name),
	}
	htmlBody, textBody, err := RenderEmailTemplate(data)
	if err != nil {
		return "", "", "", err
	}
	subject := fmt.Sprintf("Update Pesanan #%d • %s", order.ID, branding.Name)
	return subject, htmlBody, textBody, nil
}

func BuildRefundRequestEmail(order *models.Order, service *models.Service, reason string) (string, string, string, error) {
	if order == nil {
		return "", "", "", fmt.Errorf("order is required")
	}
	branding := getEmailBranding()
	serviceTitle := "Layanan"
	if service != nil && strings.TrimSpace(service.Title) != "" {
		serviceTitle = service.Title
	}
	summaryItems := []EmailSummaryItem{
		{Label: "Nomor Pesanan", Value: fmt.Sprintf("#%d", order.ID)},
		{Label: "Nama Pelanggan", Value: order.CustomerName},
		{Label: "Email Pelanggan", Value: order.CustomerEmail},
		{Label: "Layanan", Value: serviceTitle},
		{Label: "Total", Value: formatCurrencyIDR(order.Amount)},
		{Label: "Status Pembayaran", Value: humanizePaymentStatus(order.PaymentStatus)},
	}
	if strings.TrimSpace(order.PaymentMethod) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Metode Pembayaran", Value: humanizePaymentMethod(order.PaymentMethod)})
	}
	if strings.TrimSpace(reason) != "" {
		summaryItems = append(summaryItems, EmailSummaryItem{Label: "Alasan Refund", Value: reason})
	}
	data := EmailTemplateData{
		Preheader:       fmt.Sprintf("Permintaan refund baru dari pesanan #%d", order.ID),
		Title:           "Notifikasi Permintaan Refund",
		Greeting:        fmt.Sprintf("Halo Tim %s,", branding.Name),
		IntroParagraphs: []string{"Seorang pelanggan mengajukan permintaan refund melalui portal layanan."},
		SummaryTitle:    "Detail Refund",
		SummaryItems:    summaryItems,
		BodyParagraphs: []string{
			"Segera tinjau permintaan ini melalui panel admin untuk memastikan tindak lanjut yang tepat waktu.",
		},
		FooterNote: fmt.Sprintf("Email ini dikirim otomatis oleh sistem %s.", branding.Name),
	}
	htmlBody, textBody, err := RenderEmailTemplate(data)
	if err != nil {
		return "", "", "", err
	}
	subject := fmt.Sprintf("Permintaan Refund • Order #%d", order.ID)
	return subject, htmlBody, textBody, nil
}

func BuildContactNotificationEmail(message *models.Message) (string, string, string, error) {
	if message == nil {
		return "", "", "", fmt.Errorf("message is required")
	}
	branding := getEmailBranding()
	receivedAt := message.CreatedAt
	if receivedAt.IsZero() {
		receivedAt = time.Now()
	}
	summaryItems := []EmailSummaryItem{
		{Label: "Nama", Value: message.Name},
		{Label: "Email", Value: message.Email},
		{Label: "Subjek", Value: message.Subject},
		{Label: "Diterima", Value: formatDate(receivedAt)},
	}
	data := EmailTemplateData{
		Preheader:       fmt.Sprintf("Pesan baru dari %s", message.Name),
		Title:           "Pesan Baru dari Website",
		Greeting:        fmt.Sprintf("Halo Tim %s,", branding.Name),
		IntroParagraphs: []string{"Anda menerima pesan baru dari formulir kontak di website."},
		SummaryTitle:    "Detail Pengirim",
		SummaryItems:    summaryItems,
		BodyParagraphs:  []string{message.Body},
		AdditionalParagraphs: []string{
			"Segera tanggapi untuk menjaga pengalaman terbaik bagi setiap prospek.",
		},
		FooterNote: fmt.Sprintf("Email ini dikirim otomatis oleh %s.", branding.Name),
	}
	htmlBody, textBody, err := RenderEmailTemplate(data)
	if err != nil {
		return "", "", "", err
	}
	subject := fmt.Sprintf("[%s] Pesan Baru: %s", branding.Name, message.Subject)
	return subject, htmlBody, textBody, nil
}

func buildPlainTextEmail(data EmailTemplateData) string {
	var sections []string
	if data.Title != "" {
		sections = append(sections, data.Title)
	}
	if data.Greeting != "" {
		sections = append(sections, data.Greeting)
	}
	if len(data.IntroParagraphs) > 0 {
		sections = append(sections, strings.Join(data.IntroParagraphs, "\n\n"))
	}
	if data.Highlight != nil {
		highlightText := data.Highlight.Value
		if data.Highlight.Label != "" {
			highlightText = data.Highlight.Label + ": " + highlightText
		}
		if data.Highlight.Description != "" {
			highlightText += "\n" + data.Highlight.Description
		}
		sections = append(sections, highlightText)
	}
	if len(data.BodyParagraphs) > 0 {
		sections = append(sections, strings.Join(data.BodyParagraphs, "\n\n"))
	}
	if len(data.SummaryItems) > 0 {
		lines := make([]string, 0, len(data.SummaryItems))
		for _, item := range data.SummaryItems {
			lines = append(lines, fmt.Sprintf("%s: %s", item.Label, item.Value))
		}
		if data.SummaryTitle != "" {
			sections = append(sections, data.SummaryTitle+"\n"+strings.Join(lines, "\n"))
		} else {
			sections = append(sections, strings.Join(lines, "\n"))
		}
	}
	if len(data.LineItems) > 0 {
		var lines []string
		for _, item := range data.LineItems {
			desc := item.Title
			if item.Quantity != "" {
				desc += " (" + item.Quantity + ")"
			}
			if item.Description != "" {
				desc += "\n" + item.Description
			}
			desc += "\nTotal: " + item.Amount
			lines = append(lines, desc)
		}
		sections = append(sections, "Detail Item\n"+strings.Join(lines, "\n\n"))
	}
	if data.Button != nil {
		sections = append(sections, data.Button.Label+": "+data.Button.URL)
	}
	if len(data.AdditionalParagraphs) > 0 {
		sections = append(sections, strings.Join(data.AdditionalParagraphs, "\n\n"))
	}
	if data.FooterNote != "" {
		sections = append(sections, data.FooterNote)
	}
	supportLine := "Hubungi kami di " + data.Brand.SupportEmail
	if data.Brand.WebsiteURL != "" {
		supportLine += " atau kunjungi " + data.Brand.WebsiteURL
	}
	sections = append(sections, supportLine)
	sections = append(sections, fmt.Sprintf("© %d %s", data.Timestamp.Year(), data.Brand.Name))
	return strings.Join(sections, "\n\n")
}

func getEmailBranding() EmailBranding {
	name := firstNonEmpty(os.Getenv("BRAND_NAME"), os.Getenv("SITE_NAME"), "Devara Creative")
	primary := firstNonEmpty(os.Getenv("BRAND_PRIMARY"), os.Getenv("NEXT_PUBLIC_BRAND_PRIMARY"), "#C7A645")
	accent := firstNonEmpty(os.Getenv("BRAND_ACCENT"), os.Getenv("NEXT_PUBLIC_BRAND_ACCENT"), "#0B2545")
	light := firstNonEmpty(os.Getenv("BRAND_LIGHT"), os.Getenv("NEXT_PUBLIC_BRAND_LIGHT"), "#FFFFFF")
	dark := firstNonEmpty(os.Getenv("BRAND_DARK"), os.Getenv("NEXT_PUBLIC_BRAND_DARK"), "#0B2545")
	support := firstNonEmpty(os.Getenv("SUPPORT_EMAIL"), os.Getenv("ADMIN_EMAIL"), os.Getenv("SMTP_FROM"), os.Getenv("SMTP_USERNAME"), "hello@devaracreative.com")
	website := firstNonEmpty(os.Getenv("BRAND_WEBSITE"), os.Getenv("NEXT_PUBLIC_SITE_URL"), "https://devaracreative.com")
	return EmailBranding{
		Name:         name,
		PrimaryColor: normalizeColor(primary, "#C7A645"),
		AccentColor:  normalizeColor(accent, "#0B2545"),
		LightColor:   normalizeColor(light, "#FFFFFF"),
		DarkColor:    normalizeColor(dark, "#0B2545"),
		SupportEmail: strings.TrimSpace(support),
		WebsiteURL:   strings.TrimSpace(website),
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func normalizeColor(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	if strings.HasPrefix(trimmed, "#") {
		return trimmed
	}
	return "#" + trimmed
}

func formatOTP(otp string) string {
	otp = strings.ReplaceAll(otp, " ", "")
	if len(otp) == 0 {
		return otp
	}
	var builder strings.Builder
	for i, r := range otp {
		if i > 0 {
			builder.WriteRune(' ')
		}
		builder.WriteRune(r)
	}
	return builder.String()
}

func formatCurrencyIDR(amount float64) string {
	rounded := int64(math.Round(amount))
	negative := rounded < 0
	if negative {
		rounded = -rounded
	}
	digits := strconv.FormatInt(rounded, 10)
	var parts []string
	for len(digits) > 3 {
		parts = append([]string{digits[len(digits)-3:]}, parts...)
		digits = digits[:len(digits)-3]
	}
	parts = append([]string{digits}, parts...)
	result := "Rp " + strings.Join(parts, ".")
	if negative {
		result = "-" + result
	}
	return result
}

func humanizeOrderStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending":
		return "Menunggu Konfirmasi"
	case "confirmed":
		return "Terkonfirmasi"
	case "in_progress":
		return "Sedang Diproses"
	case "done", "completed":
		return "Selesai"
	case "cancelled", "canceled":
		return "Dibatalkan"
	case "refund_pending":
		return "Pengajuan Refund"
	case "refunded":
		return "Refund Selesai"
	default:
		if status == "" {
			return "-"
		}
		return strings.Title(strings.ReplaceAll(status, "_", " "))
	}
}

func humanizePaymentStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending", "requires_action":
		return "Menunggu Pembayaran"
	case "paid", "completed", "success", "settled":
		return "Pembayaran Selesai"
	case "failed", "expired":
		return "Pembayaran Gagal"
	case "refunded":
		return "Dana Dikembalikan"
	default:
		if status == "" {
			return "-"
		}
		return strings.Title(strings.ReplaceAll(status, "_", " "))
	}
}

func humanizePaymentMethod(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "bank_transfer":
		return "Transfer Bank"
	case "credit_card":
		return "Kartu Kredit"
	case "ewallet", "e_wallet":
		return "Dompet Digital"
	case "retail":
		return "Gerai Retail"
	case "qris":
		return "QRIS"
	default:
		if method == "" {
			return "-"
		}
		return strings.Title(strings.ReplaceAll(method, "_", " "))
	}
}

func formatDate(t time.Time) string {
	if t.IsZero() {
		return "-"
	}
	return t.Local().Format("02 January 2006 15:04 MST")
}
