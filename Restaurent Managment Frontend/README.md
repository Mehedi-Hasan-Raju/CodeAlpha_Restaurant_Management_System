# MHR Restaurent

## Run locally

1. Start the backend API on port `4000`.
2. Set `NEXT_PUBLIC_API_URL` to the backend API base URL, including `/api`. For local development, use `http://localhost:4000/api`.
3. Set the backend `FRONTEND_URL` to the frontend origin (default: `http://localhost:3000`) so the browser can make cross-origin API requests.
4. Start the frontend with `npm run dev`, then sign in with a backend account.

The API client stores the login token in browser local storage and sends it as a bearer token. New accounts registered from the frontend use the backend's public registration flow and receive the cashier role. Dashboard reporting is restricted to administrators by the backend.

The dashboard, point of sale, kitchen, orders, floor plan, menu management, inventory, reservations, customers, invoices, and payments are loaded from the API. They do not use local demo records.