package utils

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
)

func randomName(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func SaveUploadedFile(fh *multipart.FileHeader, dir string) (string, error) {
	os.MkdirAll(dir, 0755)
	src, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	name := randomName(16) + ext
	dstPath := filepath.Join(dir, name)
	dst, err := os.Create(dstPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)
	if err != nil {
		return "", err
	}
	return name, nil
}
