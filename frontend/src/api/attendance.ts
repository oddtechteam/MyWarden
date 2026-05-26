// TODO: implement in Phase 2
import api from '@/lib/axios'

export async function submitCheckin(imageBase64: string) {
  const { data } = await api.post('/api/v1/attendance-logs/checkin', { image: imageBase64 })
  return data
}
