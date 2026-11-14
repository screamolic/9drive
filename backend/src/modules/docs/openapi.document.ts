// Manual API contract. Keep aligned with routes; run npm run build && node --test tests/api-docs.test.mjs.
export const openApiDocument = {
  "openapi": "3.0.3",
  "info": {
    "title": "Multinary (9drive) API",
    "version": "1.0.0",
    "description": "REST API for Multinary: one file manager and upload API in front of many storage accounts (Cloudinary, S3-compatible). All dashboard endpoints use a Bearer access token obtained from `POST /auth/login`. The external upload API uses an API key with the `files:upload` scope via `POST /api/v1/uploads`. Interactive docs are served at `/api-docs`."
  },
  "servers": [
    {
      "url": "/",
      "description": "Current host"
    }
  ],
  "tags": [
    {
      "name": "Auth",
      "description": "Registration, login, sessions"
    },
    {
      "name": "API Keys",
      "description": "External upload API keys (files:upload scope)"
    },
    {
      "name": "External API",
      "description": "API-key authenticated upload endpoint"
    },
    {
      "name": "Connected Accounts",
      "description": "Storage accounts (Cloudinary, S3)"
    },
    {
      "name": "Storage",
      "description": "Quota summary and upload routing policy"
    },
    {
      "name": "Uploads",
      "description": "Upload sessions (direct + resumable)"
    },
    {
      "name": "Files",
      "description": "File listing, details, sharing, trash"
    },
    {
      "name": "Folders",
      "description": "Virtual folders"
    },
    {
      "name": "Public",
      "description": "Public share links (token, no auth)"
    },
    {
      "name": "Invites",
      "description": "File/folder invitations"
    },
    {
      "name": "Audit Logs",
      "description": "Activity log"
    },
    {
      "name": "System",
      "description": "Update, backup/restore"
    }
  ],
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Access token from POST /auth/login or POST /auth/refresh."
      },
      "apiKeyAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "API key",
        "description": "API key with the files:upload scope. Shown once when created; stored hashed."
      }
    },
    "schemas": {
      "Error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "Machine-readable error code, e.g. NO_ACCOUNT_WITH_ENOUGH_SPACE."
          },
          "message": {
            "type": "string"
          }
        },
        "required": [
          "code",
          "message"
        ]
      },
      "AuthTokens": {
        "type": "object",
        "properties": {
          "accessToken": {
            "type": "string"
          },
          "refreshToken": {
            "type": "string"
          }
        },
        "required": [
          "accessToken",
          "refreshToken"
        ]
      },
      "ConnectedAccount": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "provider": {
            "type": "string",
            "enum": [
              "s3",
              "cloudinary"
            ]
          },
          "providerAccountId": {
            "type": "string",
            "description": "\"bucket:endpoint-or-region\" for S3, cloud name for Cloudinary."
          },
          "email": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatarUrl": {
            "type": "string",
            "nullable": true
          },
          "status": {
            "type": "string",
            "enum": [
              "connected",
              "disconnected"
            ]
          },
          "storageAccount": {
            "$ref": "#/components/schemas/StorageQuota",
            "nullable": true
          }
        }
      },
      "StorageQuota": {
        "type": "object",
        "description": "Byte fields are serialized as strings (BigInt-safe JSON).",
        "properties": {
          "totalBytes": {
            "type": "string",
            "nullable": true,
            "description": "null means unlimited."
          },
          "usedBytes": {
            "type": "string"
          },
          "availableBytes": {
            "type": "string",
            "nullable": true
          },
          "trashBytes": {
            "type": "string",
            "nullable": true
          },
          "lastSyncedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          }
        }
      },
      "File": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "mimeType": {
            "type": "string"
          },
          "sizeBytes": {
            "type": "string"
          },
          "folderId": {
            "type": "string",
            "nullable": true
          },
          "connectedAccountId": {
            "type": "string",
            "nullable": true
          },
          "status": {
            "type": "string",
            "enum": [
              "active",
              "deleted"
            ]
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Folder": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "parentId": {
            "type": "string",
            "nullable": true
          },
          "color": {
            "type": "string"
          },
          "iconUrl": {
            "type": "string",
            "nullable": true
          },
          "providerFolderId": {
            "type": "string",
            "nullable": true
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    }
  },
  "paths": {
    "/health": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "Health check",
        "responses": {
          "200": {
            "description": "ok",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api-docs": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "This Swagger UI page",
        "responses": {
          "200": {
            "description": "Swagger UI HTML"
          }
        }
      }
    },
    "/auth/register": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Create an account",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "name",
                  "email",
                  "password"
                ],
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 2
                  },
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "password": {
                    "type": "string",
                    "minLength": 8
                  },
                  "captchaToken": {
                    "type": "string",
                    "description": "Required only when reCAPTCHA is configured."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Account created, tokens returned",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthTokens"
                }
              }
            }
          },
          "400": {
            "description": "Validation error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/auth/login": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Log in",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "password": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Access and refresh tokens",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthTokens"
                }
              }
            }
          },
          "401": {
            "description": "Invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/auth/refresh": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Get a new access token",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "refreshToken"
                ],
                "properties": {
                  "refreshToken": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "New access token",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "accessToken"
                  ],
                  "properties": {
                    "accessToken": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/auth/logout": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Revoke the current session",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/auth/me": {
      "get": {
        "tags": [
          "Auth"
        ],
        "summary": "Current user",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "User record"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/auth/google/url": {
      "get": {
        "tags": [
          "Auth"
        ],
        "summary": "Removed: Google sign-in (returns 410)",
        "responses": {
          "200": {
            "description": "OAuth URL"
          }
        }
      }
    },
    "/auth/google/callback": {
      "get": {
        "tags": [
          "Auth"
        ],
        "summary": "Removed: Google OAuth callback (returns 410)",
        "responses": {
          "302": {
            "description": "Redirect to frontend"
          }
        },
        "parameters": [
          {
            "name": "code",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "state",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/auth/google/exchange": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Removed: Google auth handoff exchange (returns 410)",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "token"
                ],
                "properties": {
                  "token": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Tokens"
          }
        }
      }
    },
    "/api-keys": {
      "get": {
        "tags": [
          "API Keys"
        ],
        "summary": "List API keys",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Keys (raw key never returned; only prefix + last used)"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "API Keys"
        ],
        "summary": "Create an API key",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 191
                  },
                  "expiresAt": {
                    "type": "string",
                    "format": "date-time",
                    "nullable": true
                  }
                },
                "required": [
                  "name"
                ]
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created; the raw key is shown once"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "description": "Scope files:upload is assigned by the server. The response secret is shown only once."
      }
    },
    "/api-keys/{id}": {
      "delete": {
        "tags": [
          "API Keys"
        ],
        "summary": "Revoke an API key",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/uploads": {
      "post": {
        "tags": [
          "External API"
        ],
        "summary": "Upload a file (external API key)",
        "security": [
          {
            "apiKeyAuth": []
          }
        ],
        "description": "Send sizeBytes and optional metadata BEFORE the file part. Files are buffered in memory, then sent to storage. Routing follows the dashboard policy. Returns { file } for a single upload, or { files, failed } for a batch.",
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "required": [
                  "sizeBytes",
                  "file"
                ],
                "properties": {
                  "sizeBytes": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "Actual file size in bytes. Send this field BEFORE the file."
                  },
                  "fileName": {
                    "type": "string"
                  },
                  "mimeType": {
                    "type": "string"
                  },
                  "folderId": {
                    "type": "string"
                  },
                  "file": {
                    "type": "string",
                    "format": "binary"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Upload result",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "type": "object",
                      "properties": {
                        "file": {
                          "$ref": "#/components/schemas/File"
                        }
                      }
                    },
                    {
                      "type": "object",
                      "properties": {
                        "files": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/File"
                          }
                        },
                        "failed": {
                          "type": "array",
                          "items": {
                            "type": "object"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid API key"
          }
        }
      }
    },
    "/connected-accounts": {
      "get": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "List connected storage accounts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Accounts with quota",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "accounts": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/ConnectedAccount"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/connected-accounts/s3": {
      "post": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Connect an S3-compatible bucket",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Validates the credentials with a test request before keeping the account. Works with AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2 or any custom endpoint.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "name",
                  "bucket",
                  "region",
                  "accessKeyId",
                  "secretAccessKey"
                ],
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "bucket": {
                    "type": "string"
                  },
                  "region": {
                    "type": "string"
                  },
                  "endpoint": {
                    "type": "string"
                  },
                  "accessKeyId": {
                    "type": "string"
                  },
                  "secretAccessKey": {
                    "type": "string",
                    "format": "password",
                    "writeOnly": true
                  },
                  "forcePathStyle": {
                    "type": "boolean"
                  },
                  "quotaBytes": {
                    "type": "string",
                    "description": "Optional quota in bytes; omit or use null for unlimited.",
                    "nullable": true,
                    "pattern": "^[0-9]+$"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Connected",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "account": {
                      "$ref": "#/components/schemas/ConnectedAccount"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Credentials rejected",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/connected-accounts/cloudinary": {
      "post": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Connect a Cloudinary account",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Validates the credentials against the Cloudinary Usage API before keeping the account. One cloud name can be connected only once per user.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "name",
                  "cloudName",
                  "apiKey",
                  "apiSecret"
                ],
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "cloudName": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_-]+$"
                  },
                  "apiKey": {
                    "type": "string"
                  },
                  "apiSecret": {
                    "type": "string",
                    "format": "password",
                    "writeOnly": true
                  },
                  "folder": {
                    "type": "string",
                    "description": "Defaults to \"multinary\"."
                  },
                  "quotaBytes": {
                    "type": "string",
                    "description": "Optional quota in bytes; omit or use null for unlimited.",
                    "nullable": true,
                    "pattern": "^[0-9]+$"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Connected",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "account": {
                      "$ref": "#/components/schemas/ConnectedAccount"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Cloudinary rejected the credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/connected-accounts/google/connect-url": {
      "get": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Removed: Google OAuth connect URL (returns 410)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "OAuth URL"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "providerConfigId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/connected-accounts/google/connect": {
      "get": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Removed: Google OAuth connect (returns 410)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "302": {
            "description": "Removed"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "providerConfigId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/connected-accounts/google/callback": {
      "get": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Removed: Google OAuth callback (returns 410)",
        "responses": {
          "302": {
            "description": "Redirect to frontend"
          }
        },
        "parameters": [
          {
            "name": "code",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "state",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/connected-accounts/{id}/sync-quota": {
      "post": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Re-sync quota for one account",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Fresh quota"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/connected-accounts/{id}": {
      "delete": {
        "tags": [
          "Connected Accounts"
        ],
        "summary": "Disconnect an account",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/storage/summary": {
      "get": {
        "tags": [
          "Storage"
        ],
        "summary": "Combined quota summary across accounts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Summary"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/storage/breakdown": {
      "get": {
        "tags": [
          "Storage"
        ],
        "summary": "Per-account quota breakdown",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Breakdown"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/storage/routing-policy": {
      "get": {
        "tags": [
          "Storage"
        ],
        "summary": "Get upload routing policy",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Policy"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "patch": {
        "tags": [
          "Storage"
        ],
        "summary": "Set upload routing policy",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "mode"
                ],
                "properties": {
                  "mode": {
                    "type": "string",
                    "enum": [
                      "most_available",
                      "round_robin",
                      "priority"
                    ]
                  },
                  "priorityAccountIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated policy"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/uploads": {
      "post": {
        "tags": [
          "Uploads"
        ],
        "summary": "Upload a file (multipart)",
        "description": "Send sizeBytes and optional metadata BEFORE the file part. Files are buffered in memory. For batch uploads, send filesMeta JSON first, then matching file fields; see the README.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "required": [
                  "sizeBytes",
                  "file"
                ],
                "properties": {
                  "sizeBytes": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "Actual file size in bytes. Send this field BEFORE the file."
                  },
                  "fileName": {
                    "type": "string"
                  },
                  "mimeType": {
                    "type": "string"
                  },
                  "folderId": {
                    "type": "string"
                  },
                  "file": {
                    "type": "string",
                    "format": "binary"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Upload result",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "type": "object",
                      "properties": {
                        "file": {
                          "$ref": "#/components/schemas/File"
                        }
                      }
                    },
                    {
                      "type": "object",
                      "properties": {
                        "files": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/File"
                          }
                        },
                        "failed": {
                          "type": "array",
                          "items": {
                            "type": "object"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "No account with enough space or file too large",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/uploads/resumable/init": {
      "post": {
        "tags": [
          "Uploads"
        ],
        "summary": "Start a resumable upload session",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "fileName",
                  "mimeType",
                  "sizeBytes"
                ],
                "properties": {
                  "fileName": {
                    "type": "string"
                  },
                  "mimeType": {
                    "type": "string"
                  },
                  "sizeBytes": {
                    "type": "string",
                    "description": "Decimal string (BigInt-safe)."
                  },
                  "folderId": {
                    "type": "string",
                    "nullable": true
                  },
                  "targetAccountId": {
                    "type": "string",
                    "nullable": true
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Session started",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "sessionId": {
                      "type": "string"
                    },
                    "provider": {
                      "type": "string"
                    },
                    "offset": {
                      "type": "integer"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Size invalid or no account has room",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "description": "Resumable uploads are removed (they were Google Drive only)."
      }
    },
    "/uploads/resumable/status/{id}": {
      "get": {
        "tags": [
          "Uploads"
        ],
        "summary": "Get resumable session status",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Status"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/uploads/resumable/chunk/{id}": {
      "put": {
        "tags": [
          "Uploads"
        ],
        "summary": "Send a chunk of a resumable upload",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "Content-Range",
            "in": "header",
            "description": "e.g. bytes 0-5242879/10485760",
            "schema": {
              "type": "string"
            },
            "required": true
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/octet-stream": {
              "schema": {
                "type": "string",
                "format": "binary"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Chunk stored; next offset returned"
          },
          "201": {
            "description": "Upload complete"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "List files",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "folderId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "q",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 255
            }
          },
          {
            "name": "kind",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "image",
                "video",
                "pdf",
                "doc",
                "archive"
              ]
            }
          },
          {
            "name": "accountId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "minSize",
            "in": "query",
            "schema": {
              "type": "number"
            }
          },
          {
            "name": "maxSize",
            "in": "query",
            "schema": {
              "type": "number"
            }
          },
          {
            "name": "startDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            }
          },
          {
            "name": "endDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Files"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/trash": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "List trashed files",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Trashed files"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "q",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/files/shared-links": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "List files you have shared",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Shared files"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/sync-google": {
      "post": {
        "tags": [
          "Files"
        ],
        "summary": "Removed: Google Drive sync (returns 410)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Sync result"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "connectedAccountId": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/files/batch": {
      "patch": {
        "tags": [
          "Files"
        ],
        "summary": "Move many files at once",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fileIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "minItems": 1,
                    "maxItems": 100
                  },
                  "folderId": {
                    "type": "string",
                    "nullable": true
                  }
                },
                "required": [
                  "fileIds"
                ]
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "Files"
        ],
        "summary": "Move files to trash",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fileIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "minItems": 1,
                    "maxItems": 100
                  }
                },
                "required": [
                  "fileIds"
                ]
              }
            }
          }
        }
      }
    },
    "/files/batch/restore": {
      "post": {
        "tags": [
          "Files"
        ],
        "summary": "Restore files from trash",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fileIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "minItems": 1,
                    "maxItems": 100
                  }
                },
                "required": [
                  "fileIds"
                ]
              }
            }
          }
        }
      }
    },
    "/files/batch/permanent": {
      "delete": {
        "tags": [
          "Files"
        ],
        "summary": "Permanently delete files (removes them from the provider)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fileIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "minItems": 1,
                    "maxItems": 100
                  }
                },
                "required": [
                  "fileIds"
                ]
              }
            }
          }
        }
      }
    },
    "/files/batch-download": {
      "post": {
        "tags": [
          "Files"
        ],
        "summary": "Download multiple files as a zip",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "zip stream"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fileIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "minItems": 1,
                    "maxItems": 100
                  }
                },
                "required": [
                  "fileIds"
                ]
              }
            }
          }
        }
      }
    },
    "/files/preview/{token}": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "Preview a file with a preview token",
        "parameters": [
          {
            "name": "token",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Preview stream"
          }
        }
      }
    },
    "/files/{id}": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "Get file details",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "File",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/File"
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "patch": {
        "tags": [
          "Files"
        ],
        "summary": "Rename or move a file",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Updated file"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 255
                  },
                  "folderId": {
                    "type": "string",
                    "nullable": true
                  }
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "Files"
        ],
        "summary": "Move a file to trash",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/{id}/share": {
      "post": {
        "tags": [
          "Files"
        ],
        "summary": "Create a public share link",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Share link"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "Files"
        ],
        "summary": "Remove the share link",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/{id}/public-permission": {
      "post": {
        "tags": [
          "Files"
        ],
        "summary": "Set public permission of a file",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/{id}/preview-token": {
      "post": {
        "tags": [
          "Files"
        ],
        "summary": "Mint a short-lived preview token",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Preview URL and path"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/{id}/view-url": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "Provider view URL",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Returns the res.cloudinary.com delivery URL. S3 returns null.",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Public URL"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/files/{id}/download": {
      "get": {
        "tags": [
          "Files"
        ],
        "summary": "Download a file (streams from the provider)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "Range",
            "in": "header",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "File stream"
          },
          "206": {
            "description": "Partial content"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/folders": {
      "get": {
        "tags": [
          "Folders"
        ],
        "summary": "List folders",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Folders",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "folders": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Folder"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "parentId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "all",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "1"
              ]
            }
          }
        ]
      },
      "post": {
        "tags": [
          "Folders"
        ],
        "summary": "Create a folder",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "name"
                ],
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 255
                  },
                  "parentId": {
                    "type": "string",
                    "nullable": true
                  },
                  "color": {
                    "type": "string",
                    "pattern": "^(#[0-9a-fA-F]{6}|text-[a-z]+-[0-9]+)$",
                    "maxLength": 64
                  },
                  "iconUrl": {
                    "type": "string",
                    "nullable": true,
                    "format": "uri",
                    "pattern": "^https://api\\.iconify\\.design/lucide:",
                    "maxLength": 2048
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created folder",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Folder"
                }
              }
            }
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/folders/recent": {
      "get": {
        "tags": [
          "Folders"
        ],
        "summary": "Recently used folders",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Folders"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 4,
              "maximum": 4
            }
          }
        ]
      }
    },
    "/folders/{id}": {
      "patch": {
        "tags": [
          "Folders"
        ],
        "summary": "Rename / recolor / move a folder",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Updated folder"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 255
                  },
                  "parentId": {
                    "type": "string",
                    "nullable": true
                  },
                  "color": {
                    "type": "string",
                    "pattern": "^(#[0-9a-fA-F]{6}|text-[a-z]+-[0-9]+)$",
                    "maxLength": 64
                  },
                  "iconUrl": {
                    "type": "string",
                    "nullable": true,
                    "format": "uri",
                    "pattern": "^https://api\\.iconify\\.design/lucide:",
                    "maxLength": 2048
                  }
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "Folders"
        ],
        "summary": "Delete a folder tree (files go to trash; Drive files are removed remotely)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/public/files/{token}": {
      "get": {
        "tags": [
          "Public"
        ],
        "summary": "Public share metadata (no auth)",
        "parameters": [
          {
            "name": "token",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "File metadata"
          },
          "404": {
            "description": "Unknown or expired token"
          }
        }
      }
    },
    "/public/files/{token}/download": {
      "get": {
        "tags": [
          "Public"
        ],
        "summary": "Download a shared file (no auth)",
        "parameters": [
          {
            "name": "token",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "File stream"
          }
        }
      }
    },
    "/public/files/{token}/preview": {
      "get": {
        "tags": [
          "Public"
        ],
        "summary": "Preview a shared file (no auth)",
        "parameters": [
          {
            "name": "token",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Preview stream"
          }
        }
      }
    },
    "/invites": {
      "get": {
        "tags": [
          "Invites"
        ],
        "summary": "List invites",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Invites"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "Invites"
        ],
        "summary": "Invite someone to a file or folder",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "201": {
            "description": "Invite created"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": {
                    "type": "string",
                    "format": "email"
                  },
                  "role": {
                    "type": "string",
                    "enum": [
                      "viewer",
                      "editor"
                    ],
                    "default": "viewer"
                  },
                  "targetType": {
                    "type": "string",
                    "enum": [
                      "file",
                      "folder"
                    ]
                  },
                  "targetId": {
                    "type": "string"
                  }
                },
                "required": [
                  "email",
                  "targetType",
                  "targetId"
                ]
              }
            }
          }
        }
      }
    },
    "/invites/{id}": {
      "delete": {
        "tags": [
          "Invites"
        ],
        "summary": "Revoke an invite",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/audit-logs": {
      "get": {
        "tags": [
          "Audit Logs"
        ],
        "summary": "Activity log",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Log entries"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/api-docs/openapi.json": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "OpenAPI specification",
        "responses": {
          "200": {
            "description": "OpenAPI JSON"
          }
        }
      }
    },
    "/system/google-config": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "Removed: Google OAuth config (returns 410)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Config (secret redacted)"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "System"
        ],
        "summary": "Removed: Google OAuth config (returns 410)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "201": {
            "description": "Config saved"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "clientId": {
                    "type": "string"
                  },
                  "clientSecret": {
                    "type": "string",
                    "format": "password",
                    "writeOnly": true,
                    "description": "Required for initial setup; optional when updating."
                  },
                  "redirectUri": {
                    "type": "string",
                    "format": "uri"
                  }
                },
                "required": [
                  "clientId"
                ]
              }
            }
          }
        }
      }
    },
    "/system/update": {
      "post": {
        "tags": [
          "System"
        ],
        "summary": "Self-update (PM2 setups; runs update.sh, falls back to git pull)",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Update output"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "description": " WARNING: executing this request changes server state."
      }
    },
    "/system/update-log": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "Last self-update output",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Log"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/system/backup": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "Download a database backup",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Backup file stream"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "description": "Legacy backup implementation expects a database file. This MySQL deployment may return 404; this endpoint is not a verified MySQL backup solution."
      }
    },
    "/system/restore": {
      "post": {
        "tags": [
          "System"
        ],
        "summary": "Restore a database backup",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "ok"
          },
          "401": {
            "description": "Missing, expired or invalid credentials",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "properties": {
                  "file": {
                    "type": "string",
                    "format": "binary"
                  }
                },
                "required": [
                  "file"
                ]
              }
            }
          }
        },
        "description": "Legacy database-file restore. Not verified for MySQL; do not use on production data without reviewing the implementation. WARNING: executing this request changes server state."
      }
    }
  }
} as const
