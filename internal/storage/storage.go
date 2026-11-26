// Package storage envuelve S3 (Backblaze B2) para el worker.
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/cero800/Arca/internal/config"
)

type Client struct {
	s3     *s3.Client
	bucket string
}

func New(ctx context.Context, cfg config.Config) (*Client, error) {
	if !cfg.StorageReady() {
		return nil, fmt.Errorf("faltan S3_ENDPOINT, S3_KEY o S3_SECRET")
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.S3Key, cfg.S3Secret, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("cargando configuración AWS: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		if cfg.S3Endpoint != "" {
			options.BaseEndpoint = aws.String(cfg.S3Endpoint)
		}
		options.UsePathStyle = cfg.S3ForcePath
	})

	return &Client{s3: client, bucket: cfg.S3Bucket}, nil
}

func (c *Client) Health(ctx context.Context) error {
	_, err := c.s3.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(c.bucket)})
	return err
}

func (c *Client) Download(ctx context.Context, key, path string) error {
	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("descargando %s: %w", key, err)
	}
	defer out.Body.Close()

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := io.Copy(file, out.Body); err != nil {
		return fmt.Errorf("copiando %s: %w", key, err)
	}
	return nil
}

func (c *Client) UploadFile(ctx context.Context, key, path, contentType string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}

	_, err = c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentLength: aws.Int64(info.Size()),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("subiendo %s: %w", key, err)
	}
	return nil
}

func (c *Client) PutBytes(ctx context.Context, key string, body []byte, contentType string) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(body),
		ContentLength: aws.Int64(int64(len(body))),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("subiendo %s: %w", key, err)
	}
	return nil
}

func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	return err
}
