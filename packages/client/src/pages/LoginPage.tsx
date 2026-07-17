import { FormEvent, useState } from 'react';

interface LoginPageProps {
  onLogin: (nickname: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Vui lòng nhập biệt danh của bạn.');
      return;
    }
    setError(null);
    onLogin(trimmed);
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: 'url(/ui/login/background.png)' }}
    >
      <form onSubmit={handleSubmit} className="relative w-[380px] sm:w-[430px]">
        <img
          src="/ui/login/login_box.png"
          alt=""
          className="w-full select-none pointer-events-none drop-shadow-2xl"
          draggable={false}
        />

        <div className="absolute inset-0 flex flex-col items-center px-[13%] pt-[38%] pb-[20%]">
          <h1 className="font-display text-3xl sm:text-4xl text-moon-300 mb-4 sm:mb-6 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Ma Sói Online
          </h1>

          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Nhập biệt danh..."
            autoFocus
            className="w-full rounded-full bg-night-950/70 border border-moon-400/40 px-4 py-2.5 text-center text-parchment-100 placeholder:text-mist-400 outline-none focus:ring-1 focus:ring-moon-400"
          />

          {error && <p className="text-sm text-blood-500 mt-2">{error}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            className="w-full max-w-[260px] transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src="/ui/login/play_now_button.png"
              alt="Play Now"
              className="w-full select-none pointer-events-none"
              draggable={false}
            />
          </button>

          <button
            type="button"
            onClick={() => setError('Đăng nhập Google chưa khả dụng.')}
            className="w-full max-w-[260px] mt-3 transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src="/ui/login/google_signin_button.png"
              alt="Đăng nhập với Google"
              className="w-full select-none pointer-events-none"
              draggable={false}
            />
          </button>
        </div>
      </form>
    </div>
  );
}
