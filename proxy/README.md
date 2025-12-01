Proxy deployment instructions (Vercel)

This folder contains a tiny Vercel serverless function that forwards requests to OpenRouter
using a server-side API key. Deploying this lets your extension call a stable URL you control
instead of calling OpenRouter directly.

Steps to deploy:

1. Install Vercel CLI (optional) or use the Vercel web dashboard.

   npm i -g vercel

2. From this directory, run:

   vercel deploy --prod

3. Set the environment variable on the Vercel project (in dashboard or CLI):

   OPENROUTER_API_KEY = <your-openrouter-key>

4. Note the function URL (for example: https://yourname.vercel.app/api). In the extension Options
   set the Proxy URL to that value (append the path to the function if needed, e.g.
   https://yourname.vercel.app/api ).

Security notes:
- Keep the OPENROUTER_API_KEY secret. Do not commit it to source control.
- Optionally restrict origin/headers in the function if desired.
