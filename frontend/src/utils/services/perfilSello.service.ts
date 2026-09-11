import { api } from "@/lib/api";

export const perfilSelloService = {
  async subirMiSello(file: File): Promise<string> {
    const form = new FormData();
    form.append("sello", file);
    const { data } = await api.post<{ success: boolean; sello_url: string }>(
      "/auth/me/sello",
      form,
      { timeout: 60000 },
    );
    return data.sello_url;
  },

  async eliminarMiSello(): Promise<void> {
    await api.delete("/auth/me/sello");
  },

  async subirSelloUsuario(usuarioId: string, file: File): Promise<string> {
    const form = new FormData();
    form.append("sello", file);
    const { data } = await api.post<{ success: boolean; sello_url: string }>(
      `/admin/usuarios/${usuarioId}/sello`,
      form,
      { timeout: 60000 },
    );
    return data.sello_url;
  },

  async eliminarSelloUsuario(usuarioId: string): Promise<void> {
    await api.delete(`/admin/usuarios/${usuarioId}/sello`);
  },
};
