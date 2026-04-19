# API Documentation

## Overview

The FlexibleAccessible API provides accessibility scanning and remediation services.

## Authentication

Currently uses cookie-based session authentication.

## Endpoints

### Scanning
- `POST /api/scan` - Initiate a new scan
- `GET /api/scan/:id` - Get scan status

### Issues
- `GET /api/issues` - List issues
- `GET /api/issues/:id` - Get issue details

### Remediation
- `POST /api/remediate` - Generate remediation suggestions
