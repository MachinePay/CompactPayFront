import { useState } from "react";
import { login as loginApi } from "../api/authService";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await loginApi(email, password);
      login(data.access_token);
      window.location.href = "/dashboard";
    } catch {
      // Mensagem de erro será exibida pelo Toast global
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bgmain">
      <form
        onSubmit={handleSubmit}
        className="bg-bgcard p-8 rounded shadow w-96 flex flex-col gap-4"
      >
        <h1 className="text-2xl text-white font-bold mb-4">CompactPay Login</h1>
        <input
          className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit">Entrar</Button>
      </form>
    </div>
  );
}
