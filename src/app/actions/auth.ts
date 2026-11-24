"use server";

import { signIn, signOut } from "@/auth";

// signIn/signOut은 성공 시 redirect를 throw하므로 try/catch로 감싸지 않는다.
export async function signInWithGitHub() {
  await signIn("github", { redirectTo: "/bookmarks" });
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/bookmarks" });
}

export async function signInAsGuest() {
  await signIn("guest", { redirectTo: "/bookmarks" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
