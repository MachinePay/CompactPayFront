import api from "./axios";

export const login = async (email, password) => {
  const form = new FormData();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post("/login", form);
  return data;
};
