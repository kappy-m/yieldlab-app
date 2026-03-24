"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchUsers, createUser, updateUser, deleteUser, setUserProductRoles,
  type UserManageOut, type ProductCode, type ProductRole,
} from "@/lib/api";
import { UserPlus, Trash2, Shield, ChevronDown, ChevronUp, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRODUCTS: { code: ProductCode; label: string; color: string }[] = [
  { code: "yield",       label: "Yield",       color: "bg-blue-100 text-blue-700" },
  { code: "manage",      label: "Manage",      color: "bg-indigo-100 text-indigo-700" },
  { code: "review",      label: "Review",      color: "bg-yellow-100 text-yellow-700" },
  { code: "reservation", label: "Reservation", color: "bg-green-100 text-green-700" },
];

const ROLE_OPTIONS: { value: ProductRole; label: string }[] = [
  { value: "admin",  label: "管理者" },
  { value: "editor", label: "編集者" },
  { value: "viewer", label: "閲覧のみ" },
];

function RoleBadge({ role }: { role: ProductRole | undefined }) {
  if (!role) return <span className="text-xs text-slate-400">-</span>;
  const colors: Record<ProductRole, string> = {
    admin:  "bg-purple-100 text-purple-700",
    editor: "bg-blue-100 text-blue-700",
    viewer: "bg-slate-100 text-slate-600",
  };
  const labels: Record<ProductRole, string> = {
    admin: "管理者", editor: "編集者", viewer: "閲覧",
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", colors[role])}>
      {labels[role]}
    </span>
  );
}

// ── 権限編集行 ────────────────────────────────────────────────
function ProductRoleEditor({
  user,
  onSaved,
}: {
  user: UserManageOut;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<Partial<Record<ProductCode, ProductRole>>>(user.product_roles ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const roleList = Object.entries(roles)
        .filter(([, r]) => r)
        .map(([code, role]) => ({ product_code: code as ProductCode, role: role as ProductRole }));
      await setUserProductRoles(user.id, roleList);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-xs font-medium text-slate-500 mb-2">プロダクト別アクセス権限</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRODUCTS.map(({ code, label }) => (
          <div key={code} className="space-y-1">
            <span className="text-xs text-slate-500">{label}</span>
            <select
              value={roles[code] ?? ""}
              onChange={(e) =>
                setRoles((prev) => ({
                  ...prev,
                  [code]: (e.target.value as ProductRole) || undefined,
                }))
              }
              className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
            >
              <option value="">アクセス不可</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded px-3 py-1.5 transition-colors cursor-pointer"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : null}
          {saved ? "保存済み" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ── ユーザー行 ────────────────────────────────────────────────
function UserRow({
  user,
  currentUserId,
  onDeleted,
  onRefresh,
}: {
  user: UserManageOut;
  currentUserId: number;
  onDeleted: () => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isSelf = user.id === currentUserId;

  const handleDelete = async () => {
    if (!confirm(`${user.name} を削除しますか？`)) return;
    setDeleting(true);
    try {
      await deleteUser(user.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
          {user.name[0]?.toUpperCase() ?? "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">{user.name}</span>
            {isSelf && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">自分</span>
            )}
            {!user.is_active && (
              <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded">無効</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>

        {/* プロダクト権限バッジ */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {PRODUCTS.filter((p) => user.product_roles?.[p.code]).map(({ code, label, color }) => (
            <span key={code} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", color)}>
              {label}
            </span>
          ))}
          {Object.keys(user.product_roles ?? {}).length === 0 && (
            <span className="text-[10px] text-slate-400">権限なし</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors text-slate-500 cursor-pointer"
            title="権限を編集"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {!isSelf && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded hover:bg-red-50 transition-colors text-red-400 disabled:opacity-40 cursor-pointer"
              title="削除"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-slate-50/60">
          <ProductRoleEditor user={user} onSaved={onRefresh} />
        </div>
      )}
    </div>
  );
}

// ── 新規ユーザーフォーム ─────────────────────────────────────
function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createUser({ email, name, password });
      setEmail(""); setName(""); setPassword("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        ユーザーを追加
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-purple-200 rounded-lg p-4 bg-purple-50/40 space-y-3">
      <p className="text-sm font-semibold text-slate-700">新規ユーザーを追加</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">名前 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="山田 太郎"
            className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">メールアドレス *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@example.com"
            className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">初期パスワード *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 cursor-pointer"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded px-3 py-1.5 transition-colors cursor-pointer"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          作成する
        </button>
      </div>
    </form>
  );
}

// ── メインパネル ─────────────────────────────────────────────
export function UserAccessPanel() {
  const [users, setUsers] = useState<UserManageOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("yl_user") ?? "{}");
      setCurrentUserId(u.id ?? 0);
      setIsAdmin(u.role === "admin");
    } catch { /* no-op */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600" />
            ユーザーとアクセス権限管理
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            ユーザーごとにアクセス可能なプロダクトとロールを設定します
          </p>
        </div>
        <span className="text-xs text-slate-400">{users.length}名</span>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          ユーザー権限の変更は管理者のみ行えます
        </div>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            currentUserId={currentUserId}
            onDeleted={load}
            onRefresh={load}
          />
        ))}
      </div>

      {isAdmin && (
        <div className="pt-2">
          <NewUserForm onCreated={load} />
        </div>
      )}
    </div>
  );
}
