# Movie Recommender Backend

Express.js backend API for a movie recommender application with user authentication.

## Features

- User registration and login
- JWT-based authentication
- Protected routes middleware
- Error handling middleware
- MongoDB integration with Mongoose
- CORS configuration
- Cookie-based token storage

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd movie-recommender-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/movie-recommender
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=30d
CLIENT_URL=http://localhost:3000
```

5. Make sure MongoDB is running on your system.

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## API Endpoints

### Authentication Routes

#### Register User
- **POST** `/api/auth/register`
- **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "data": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```

#### Login User
- **POST** `/api/auth/login`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response:** Same as register

#### Get Current User
- **GET** `/api/auth/me`
- **Headers:** `Authorization: Bearer <token>` or Cookie with token
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```

#### Logout User
- **GET** `/api/auth/logout`
- **Headers:** `Authorization: Bearer <token>` or Cookie with token
- **Response:**
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### Health Check
- **GET** `/health`
- **Response:**
  ```json
  {
    "status": "success",
    "message": "Server is running",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

## Project Structure

```
movie-recommender-backend/
├── controllers/
│   └── authController.js
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
├── models/
│   └── User.js
├── routes/
│   └── authRoutes.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Tokens can be sent either:
- As a Bearer token in the Authorization header: `Authorization: Bearer <token>`
- As an HTTP-only cookie (automatically set on login/register)

## Error Handling

All errors are handled by the error middleware and return a consistent format:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Security Features

- Passwords are hashed using bcryptjs
- JWT tokens with expiration
- HTTP-only cookies for token storage
- CORS configuration
- Input validation

## License

ISC

