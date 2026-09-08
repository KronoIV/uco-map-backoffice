import api from './api';
import type { AppSetting, SettingType } from '../types';

export interface AppSettingRequest {
  value: string;
  type?: SettingType;
  description?: string;
  category?: string;
}

export interface AppSettingCreateRequest extends AppSettingRequest {
  key: string;
}

export const settingsService = {
  /** Retorna todos los parámetros de configuración activos. */
  getAll: () =>
    api.get<AppSetting[]>('/api/settings').then(r => r.data),

  /** Retorna un parámetro específico por clave. */
  getByKey: (key: string) =>
    api.get<AppSetting>(`/api/settings/${encodeURIComponent(key)}`).then(r => r.data),

  /** Crea un nuevo parámetro. Lanza 409 si la clave ya existe. */
  create: (data: AppSettingCreateRequest) =>
    api.post<AppSetting>('/api/settings', data).then(r => r.data),

  /** Actualiza el valor y metadatos de un parámetro existente. */
  update: (key: string, data: AppSettingRequest) =>
    api.put<AppSetting>(`/api/settings/${encodeURIComponent(key)}`, data).then(r => r.data),

  /** Elimina permanentemente un parámetro. */
  remove: (key: string) =>
    api.delete(`/api/settings/${encodeURIComponent(key)}`),
};
