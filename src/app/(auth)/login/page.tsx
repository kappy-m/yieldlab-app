"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { TrendingUp, Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("yl_token");
    if (token) router.replace("/yield");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      localStorage.setItem("yl_token", res.access_token);
      localStorage.setItem("yl_user", JSON.stringify({
        id: res.user_id,
        name: res.name,
        role: res.role,
        org_id: res.org_id,
        product_roles: res.product_roles,
      }));
      // アクセス可能な最初のプロダクトにリダイレクト
      const productOrder = ["yield", "manage", "review", "reservation"] as const;
      const first = productOrder.find((p) => res.product_roles?.[p]) ?? "yield";
      router.replace(`/${first}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">YieldLab</h1>
            <p className="text-xs text-slate-400">Revenue Intelligence Platform</p>
          </div>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-1">ログイン</h2>
          <p className="text-sm text-slate-400 mb-6">アカウント情報を入力してください</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">メールアドレス</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">パスワード</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          {/* デモアカウント情報 */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-slate-500 mb-3">デモアカウント</p>
            <div className="space-y-2">
              {[
                { role: "管理者", email: "admin@example.com", badge: "bg-purple-500/20 text-purple-300" },
                { role: "レベニューMgr", email: "revenue@example.com", badge: "bg-blue-500/20 text-blue-300" },
                { role: "閲覧のみ", email: "viewer@example.com", badge: "bg-slate-500/20 text-slate-300" },
              ].map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword("admin123"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <span className="text-xs text-slate-300">{u.email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.badge}`}>{u.role}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3">パスワード: admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
