import { redirect } from "next/navigation";

/**
 * Home Page - Redirects to tokens page
 */
export default function Home() {
  redirect("/tokens");
}
