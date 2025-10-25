package utils

import (
	"crypto/tls"
	"fmt"
	"log"
	"os"
	"strconv"

	"devara-creative-backend/app/models"

	"gopkg.in/gomail.v2"
)

func getenv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func SendEmail(to, subject, htmlBody, textBody string) error {
	host := getenv("SMTP_HOST", "smtp.gmail.com")
	portStr := getenv("SMTP_PORT", "587")
	user := getenv("SMTP_USERNAME", "")
	pass := getenv("SMTP_PASSWORD", "")
	from := getenv("SMTP_FROM", "Devara Creative <devaracreative@gmail.com>")

	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Printf("Invalid SMTP_PORT: %v", err)
		return fmt.Errorf("invalid SMTP_PORT")
	}

	if user == "" || pass == "" {
		log.Println("SMTP_USERNAME or SMTP_PASSWORD not set. Skipping email.")
		return fmt.Errorf("smtp not configured")
	}

	m := gomail.NewMessage()
	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", textBody)
	m.AddAlternative("text/html", htmlBody)

	d := gomail.NewDialer(host, port, user, pass)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: false, ServerName: host}

	if err := d.DialAndSend(m); err != nil {
		log.Printf("Failed to send email to %s: %v", to, err)
		return err
	}
	log.Printf("Email sent successfully to %s", to)
	return nil
}

func SendAdminOrderNotification(order *models.Order, service *models.Service) error {
	adminEmail := getenv("ADMIN_EMAIL", "")
	if adminEmail == "" {
		log.Println("ADMIN_EMAIL not set, skipping admin notification")
		return nil
	}
	subject := fmt.Sprintf("Pesanan Baru Diterima: #%d - %s", order.ID, service.Title)
	htmlBody := fmt.Sprintf(
		"<html><body><h2>Pesanan Baru Diterima</h2>"+
			"<p><strong>ID Pesanan:</strong> #%d</p>"+
			"<p><strong>Layanan:</strong> %s</p>"+
			"<p><strong>Nama:</strong> %s</p>"+
			"<p><strong>Email:</strong> %s</p>"+
			"<p><strong>Telepon:</strong> %s</p>"+
			"<p><strong>Total:</strong> %s</p>"+
			"<p><strong>Catatan:</strong> %s</p>"+
			"</body></html>",
		order.ID, service.Title, order.CustomerName, order.CustomerEmail, order.CustomerPhone, formatCurrencyIDR(order.Amount), order.Notes,
	)
	textBody := fmt.Sprintf(
		"Pesanan Baru Diterima:\n"+
			"ID Pesanan: #%d\n"+
			"Layanan: %s\n"+
			"Nama: %s\n"+
			"Email: %s\n"+
			"Telepon: %s\n"+
			"Total: %s\n"+
			"Catatan: %s\n",
		order.ID, service.Title, order.CustomerName, order.CustomerEmail, order.CustomerPhone, formatCurrencyIDR(order.Amount), order.Notes,
	)
	return SendEmail(adminEmail, subject, htmlBody, textBody)
}

func SendAdminPaymentProofNotification(order *models.Order) error {
	adminEmail := getenv("ADMIN_EMAIL", "")
	if adminEmail == "" {
		log.Println("ADMIN_EMAIL not set, skipping admin notification")
		return nil
	}
	baseURL := getenv("APP_BASE_URL", "http://localhost:8000")
	proofURL := baseURL + "/" + order.PaymentProofURL
	subject := fmt.Sprintf("Bukti Pembayaran Diterima untuk Pesanan #%d", order.ID)
	htmlBody := fmt.Sprintf(
		"<html><body><h2>Bukti Pembayaran Diterima</h2>"+
			"<p>Pesanan <strong>#%d</strong> telah mengunggah bukti pembayaran.</p>"+
			"<p>Nama: %s</p>"+
			"<p>Email: %s</p>"+
			"<p>Silakan verifikasi melalui link berikut:</p>"+
			"<p><a href=\"%s\">Lihat Bukti Pembayaran</a></p>"+
			"</body></html>",
		order.ID, order.CustomerName, order.CustomerEmail, proofURL,
	)
	textBody := fmt.Sprintf(
		"Bukti Pembayaran Diterima\n"+
			"Pesanan #%d telah mengunggah bukti pembayaran.\n"+
			"Nama: %s\n"+
			"Email: %s\n"+
			"Silakan verifikasi di: %s\n",
		order.ID, order.CustomerName, order.CustomerEmail, proofURL,
	)
	return SendEmail(adminEmail, subject, htmlBody, textBody)
}
