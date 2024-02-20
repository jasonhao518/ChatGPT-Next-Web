import { authMiddleware } from "@clerk/nextjs";
 
export default authMiddleware({
  // Routes that can be accessed while signed out
  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: ['/site.webmanifest'],
});

export const config = {
  matcher: ["/:path*"],
}
