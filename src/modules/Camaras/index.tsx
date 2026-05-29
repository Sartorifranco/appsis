import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CameraMonitor } from './CameraMonitor'

export function CamarasPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Cámaras & NVR</h1>
      <div className="space-y-4">
        <CameraMonitor />
        <Card>
          <CardHeader>
            <CardTitle>Credenciales y NVR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Listado de cámaras, NVRs y estado de grabación. Usa el tipo <code>Camara</code> en
              <code className="ml-1">@/types</code>. Las IPs se configuran en{' '}
              <code className="rounded bg-muted px-1">VITE_CAMERA_IPS</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
