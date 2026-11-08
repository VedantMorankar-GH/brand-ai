# Required setup before login and registration work

The uploaded project is configured for MongoDB Atlas, but it does not contain database credentials. The backend cannot start until you replace the placeholders in `server/.env`.

1. Create a free MongoDB Atlas cluster.
2. Create a database user and allow your current IP address in Network Access.
3. In Atlas, choose Connect -> Drivers -> Node.js and copy the connection string.
4. Open `server/.env` and replace the entire `MONGODB_URI` value with your real Atlas URI. Replace the username, password, cluster and database placeholders. URL-encode special characters in the database password.
5. Registration does not require an invitation code. New accounts are automatically assigned the Creator role in `REGISTRATION_ORGANIZATION`.
6. Change `JWT_SECRET` to a newly generated random value of at least 32 characters.
7. In a terminal opened in `server`, run `npm install` then `npm run dev`.
8. In another terminal opened in the project root, run `npm install` then `npm run dev`.
9. Open `http://localhost:5173`.

The frontend now displays a more useful message when it cannot reach the API. This package does not include or create an Atlas database, and a live database connection has not been tested because no Atlas credentials were provided.
