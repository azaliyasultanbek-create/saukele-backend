# Saukele Backend

Wedding gift management platform with multi-currency support, family tier-based access control, and real-time contribution tracking.

## Project Overview

Saukele is a comprehensive wedding gift management system that allows couples to create wishlists and manage contributions from guests organized by family relationship tiers. The platform supports multiple currencies (KZT, USD, EUR) with real-time exchange rates and provides email notifications for key events.

## Tech Stack

### Core Technologies
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with ioredis + BullMQ
- **Authentication**: JWT with refresh tokens
- **Email**: SendGrid

### Key Dependencies
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT authentication
- **bullmq**: Background job processing
- **@sendgrid/mail**: Email delivery
- **express-validator**: Input validation
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing
- **express-rate-limit**: API rate limiting
- **swagger-ui-express**: API documentation

### Development Tools
- **Jest**: Testing framework
- **Supertest**: HTTP assertions
- **Nodemon**: Development auto-reload
- **Prisma**: Database migrations and client generation

## Features

### Authentication & Authorization
- Phone and email-based registration
- Email verification with secure tokens
- Password reset flow
- JWT access tokens (15min) + refresh tokens (7 days)
- Role-based access control (couple, guest, admin)
- Email verification enforcement on protected routes

### Wedding Management
- Couples can create wedding profiles
- Multiple wedding support
- Guest family tree with traditional Kazakh kinship tiers (ata_ana, zhien_zaran, kuda_zhekzhen)
- Tier-based gift visibility with genealogical hierarchy (WITH RECURSIVE CTE)

### Gift Management
- Multi-currency support (KZT, USD, EUR)
- Real-time currency conversion
- Gift funding progress tracking
- Status management (pending → funding → funded → paid_out)
- Contribution limits (max 80% of remaining amount)

### Contributions
- Anonymous and named contributions
- Multi-currency payment support
- Automatic currency conversion
- Email notifications on contribution
- Email notifications when gift is fully funded

### Background Workers
- **Email Worker**: Processes verification, password reset, and notification emails
- **Currency Worker**: Updates exchange rates every 30 minutes

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- SendGrid API key

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd saukele-backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` with your actual values:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/saukele"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your_32_character_minimum_secret_key"
JWT_REFRESH_SECRET="your_32_character_minimum_refresh_key"
SENDGRID_API_KEY="your_sendgrid_api_key"
EMAIL_FROM="noreply@yourdomain.com"
FRONTEND_URL="http://localhost:3000"
```

4. Run database migrations
```bash
npx prisma migrate dev
```

5. Generate Prisma client
```bash
npx prisma generate
```

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

#### Background Workers
In separate terminals:
```bash
npm run worker:email
npm run worker:currency
```

### Using Docker Compose

The project includes a `docker-compose.yml` for PostgreSQL and Redis:

```bash
docker-compose up -d
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DATABASE_POOL_MIN` | No | 2 | Minimum database connection pool size |
| `DATABASE_POOL_MAX` | No | 10 | Maximum database connection pool size |
| `REDIS_URL` | Yes | - | Redis connection URL |
| `JWT_SECRET` | Yes | - | Secret for access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | No | JWT_SECRET | Secret for refresh tokens |
| `SENDGRID_API_KEY` | Yes | - | SendGrid API key for emails |
| `EMAIL_FROM` | Yes | - | Sender email address |
| `EMAIL_FROM_NAME` | No | Saukele | Sender display name |
| `FRONTEND_URL` | Yes | - | Frontend URL for email links |
| `KASPI_API_KEY` | No | - | Kaspi payment integration (future) |
| `ADMIN_API_KEY` | No | - | Admin API key |
| `NODE_ENV` | No | development | Environment (development/production) |
| `PORT` | No | 3000 | Server port |

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## API Documentation

Interactive API documentation is available at `/api-docs` when the server is running.

Example: http://localhost:3000/api-docs

The same Swagger UI is also mounted at `/docs` for defense compatibility:

Example: http://localhost:3000/docs

The documentation is generated from `openapi.yaml` using Swagger UI.

## Pre-Defense Compliance Notes

- All application database access goes through Prisma ORM. Raw SQL is limited to Prisma migration files.
- Auth endpoints implement register, email verification by code, login, refresh token rotation, logout, password reset, and `/auth/me`.
- Unverified users are blocked from login and protected business endpoints.
- RBAC is enforced with `couple` and `guest` roles. Admin queue visibility uses `x-admin-api-key`.
- Email events are queued for verification, password reset, contribution confirmation, and fully funded gift notification.
- In production, set `USE_MOCK_REDIS=false` and run `npm run worker:email` so email delivery is handled asynchronously by BullMQ/Redis.
- In local demo mode, `USE_MOCK_REDIS=true` prints verification codes to console; with a real `SG.*` SendGrid key it can also send directly for easier demonstration.
- Queue visibility is available at `GET /admin/queues` with the `x-admin-api-key` header.
- Currency refresh is scheduled by `npm run worker:currency` every 30 minutes.
- Current Express routes do not use `/api` prefix. Use `/auth/register`, `/gifts`, `/couples/weddings`, etc.

## Architecture Decisions

### Email Verification Enforcement
All protected routes (except `/auth/*`) require email verification. Users must verify their email before accessing gift creation, contributions, or wedding profile management.

### Background Job Processing
Email sending and currency updates are handled asynchronously using BullMQ to prevent blocking the main request-response cycle.

### Multi-Currency Strategy
- Currency rates are cached in Redis and refreshed every 30 minutes
- Contributions are stored in the gift's target currency
- Exchange rates are recorded with each contribution for audit purposes

### Family Tier System (Традиционные категории родства)
Access to gifts is controlled by kinship tiers with hierarchical visibility:
  
| Тир | Категория | Описание | Видит подарки |
|-----|-----------|----------|---------------|
| `ata_ana` | ATA_ANA | Ата-ана — родители и старшие | Все подарки |
| `zhien_zaran` | ZHIEN_ZhARAN | Жиен-жаран — родственники по линии матери | zhien_zaran, kuda_zhekzhen |
| `kuda_zhekzhen` | KUDA_ZHEKZhEN | Құда-жекжең — сваты/кумовья | Только kuda_zhekzhen |

### Genealogical Tree (Генеалогическое древо)
Рекурсивный CTE-запрос (`WITH RECURSIVE`) строит иерархическое дерево родственников:
- `GET /api/family/tree/:coupleId` — полное древо с группировкой по категориям
- Поддержка `parentId` для построения иерархии "родитель-ребёнок"
- Результат группируется по трём традиционным категориям

### Kinship Registry (Реестр родства)
Пара может вести реестр традиционных категорий родства:
- `POST /api/family/registry` — создать запись реестра
- `GET /api/family/registry/:coupleId` — получить реестр с иерархией
- Nephews: see nephews, distant gifts
- Distant: see only distant gifts

### Security Measures
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with short expiry (15min access, 7d refresh)
- Refresh tokens stored in Redis for revocation capability
- Email/password reset tokens are one-time use only
- Rate limiting on all endpoints
- Helmet.js for security headers
- CORS configuration for production

### Database Design
- Cascading deletes on user/couple removal
- Composite indexes on frequently queried fields
- JSON fields for flexible arrays (allowedTiers, imageUrls)
- Separate UserToken table for verification/reset tokens

## Project Structure

```
saukele-backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Server entry point
│   ├── config/
│   │   ├── database.js        # Prisma client
│   │   ├── redis.js           # Redis client
│   │   └── env.js             # Environment validation
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Auth, validation middleware
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   │   ├── authService.js
│   │   ├── currencyService.js
│   │   └── emailService.js
│   ├── queues/
│   │   └── emailQueue.js      # BullMQ queue setup
│   └── workers/
│       ├── emailWorker.js     # Email processing worker
│       └── currencyWorker.js  # Currency update worker
├── tests/                     # Jest tests
├── .env.example               # Environment template
├── docker-compose.yml         # Local services setup
├── openapi.yaml               # API specification
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with phone/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (revoke refresh token)
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/verify-email?token=` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Wedding Profiles (Couples)
- `POST /api/couples/profile` - Create wedding profile (couple only)
- `GET /api/couples/profile/:coupleId` - Get wedding profile
- `PUT /api/couples/profile/:coupleId` - Update wedding profile (couple only)
- `GET /api/couples` - List all active weddings (public, paginated)

### Gifts
- `POST /api/gifts` - Create gift (couple only)
- `GET /api/gifts` - List couple's gifts (paginated)
- `GET /api/gifts/:giftId` - Get gift details
- `PUT /api/gifts/:giftId` - Update gift (couple only)
- `DELETE /api/gifts/:giftId` - Delete gift (couple only, no contributions)

### Contributions
- `POST /api/contributions` - Create contribution (guest or couple)
- `GET /api/contributions/gift/:giftId` - List contributions for gift (paginated)

### Family Tree
- `POST /api/family/members` - Add guest to family tree (couple only)
- `GET /api/family/my-kinship` - Get current user's kinship tier
- `GET /api/family/gifts` - Get gifts accessible by user's tier (paginated)
- `GET /api/family/tree/:coupleId` - Get hierarchical genealogical tree (recursive CTE)
- `POST /api/family/registry` - Create registry entry for traditional kinship category
- `GET /api/family/registry/:coupleId` - Get kinship registry with hierarchy

## Changelog

See `CHANGELOG.md` for deviations from the original OpenAPI specification.

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Run tests: `npm test`
5. Submit a pull request

## License

ISC
