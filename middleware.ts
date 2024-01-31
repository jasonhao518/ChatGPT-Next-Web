import { getToken } from "next-auth/jwt"
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { kv } from '@vercel/kv';

export default withAuth(
  async function middleware(req) {
    const token = await getToken({ req })
    
    const isAuth = !!token
    const isSiteWeb = req.nextUrl.pathname.startsWith("/site.webmanifest")
    const isAPI = req.nextUrl.pathname.startsWith("/api/openai") || 
                  req.nextUrl.pathname.startsWith("/api/google") ||
                  req.nextUrl.pathname.startsWith("/api/upstash")

    let from = req.nextUrl.protocol + req.nextUrl.host + req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    if (!isAuth && !isSiteWeb) {
      return NextResponse.redirect(
        new URL(`https://www.${process.env.ROOT_DOMAIN}/login?from=${encodeURIComponent(from)}`, req.url)
      );
    }else if(isAPI){
      // if calling api, check quota
      const value = await kv.get(btoa(token?.email!)) as number
      if(value == null) {
         // if user not present in the system, set free trail quota
         kv.set(btoa(token?.email!),1000)
         return null
      }else if(value <= 0) {
        // no quota
        return NextResponse.json({ eror: "Out of quota, please upgrade your plan" }, { status: 403 });
      }else {
        const current = await kv.decr(btoa(token?.email!));
        console.log(current)
        return null
      }
    }else {
      return null
    }
  },
  {
    callbacks: {
      async authorized() {
        // This is a work-around for handling redirect on auth pages.
        // We return true here so that the middleware function above
        // is always called.
        return true
      },
    },
  }
)

export const config = {
  matcher: ["/:path*"],
}
