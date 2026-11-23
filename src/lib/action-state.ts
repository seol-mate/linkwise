// Server Action(useActionState)이 클라이언트로 돌려주는 상태.
// "use server" 파일은 async 함수만 export할 수 있어서 별도 파일로 둔다.
export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialActionState: ActionState = { status: "idle", message: "" };
