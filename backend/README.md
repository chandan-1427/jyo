# Backend Setup Guide

This guide provides instructions to clone, set up, and run the backend for this project.

## Prerequisites

Ensure you have the following installed on your system:
- Node.js (v16 or higher recommended)
- pnpm (v8 or higher recommended)

## Steps to Clone and Run the Backend

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd <repository-folder>/backend
   ```

2. **Install Dependencies**
   Use `pnpm` to install the required dependencies:
   ```bash
   pnpm install
   ```

3. **Run the Development Server**
   Start the development server with the following command:
   ```bash
   pnpm run dev
   ```

4. **Access the Application**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Additional Commands

- **Build the Project**:
  ```bash
  pnpm run build
  ```

- **Start the Production Server**:
  ```bash
  pnpm start
  ```

- **Database Commands**:
  - Generate database migrations:
    ```bash
    pnpm run db:generate
    ```
  - Apply migrations:
    ```bash
    pnpm run db:migrate
    ```
  - Push schema changes:
    ```bash
    pnpm run db:push
    ```
  - Open Drizzle Studio:
    ```bash
    pnpm run db:studio
    ```
