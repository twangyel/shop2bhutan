import { useAuth } from '../contexts/AuthContext';

export function AuthDebugBox() {
  const { loading, user, context } = useAuth();

  if (loading) {
    return (
      <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-700">
        Loading auth...
      </div>
    );
  }

  return (
    <pre className="rounded-xl bg-slate-900 p-4 text-xs text-white overflow-auto">
      {JSON.stringify(
        {
          email: user?.email ?? null,
          role: context?.role ?? null,
          is_admin: context?.is_admin ?? false,
          is_super_admin: context?.is_super_admin ?? false,
        },
        null,
        2
      )}
    </pre>
  );
}