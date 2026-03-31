import { apiFetch } from "./client";
import type { ProductCode, AnyProductRole } from "./client";

// ---- User Management ----

export interface UserManageOut {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  product_roles: Partial<Record<ProductCode, AnyProductRole>>;
}

export function fetchUsers(): Promise<UserManageOut[]> {
  return apiFetch<UserManageOut[]>("/users/");
}

export function createUser(data: {
  email: string;
  name: string;
  password: string;
  role?: string;
  product_roles?: Partial<Record<ProductCode, AnyProductRole>>;
}): Promise<UserManageOut> {
  return apiFetch<UserManageOut>("/users/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(
  userId: number,
  data: { name?: string; role?: string; is_active?: boolean; password?: string }
): Promise<UserManageOut> {
  return apiFetch<UserManageOut>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteUser(userId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}`, { method: "DELETE" });
}

export function setUserProductRoles(
  userId: number,
  roles: Array<{ product_code: ProductCode; role: AnyProductRole }>
): Promise<UserManageOut> {
  return apiFetch<UserManageOut>(`/users/${userId}/product-roles`, {
    method: "PUT",
    body: JSON.stringify(roles),
  });
}
