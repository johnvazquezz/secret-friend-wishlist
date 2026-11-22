import { BellOff, BellRing } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import { usePushNotifications } from './hooks';
import IosInstallGuide from './IosInstallGuide';

/** Tarjeta de Mi perfil para activar o desactivar las notificaciones push en este dispositivo. */
export default function PushSettingsCard({ userId }: { userId: string }) {
  const { status, busy, enable, disable } = usePushNotifications(userId);

  if (status === 'unavailable') return null;

  const description =
    status === 'on'
      ? 'Activadas en este dispositivo.'
      : 'Te avisamos de mensajes y novedades aunque tengas la app cerrada.';

  let action = null;
  if (status === 'off' || status === 'loading') {
    action = (
      <Button onClick={() => void enable()} disabled={busy || status === 'loading'}>
        <BellRing aria-hidden="true" className="w-4 h-4" />
        Activar notificaciones
      </Button>
    );
  } else if (status === 'on') {
    action = (
      <Button variant="secondary" onClick={() => void disable()} disabled={busy}>
        <BellOff aria-hidden="true" className="w-4 h-4" />
        Desactivar
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<BellRing />}
        title="Notificaciones en el celular"
        description={description}
        className={action ? '' : 'mb-4'}
      />
      {status === 'ios-install' && <IosInstallGuide />}
      {status === 'denied' && (
        <p className="text-sm text-stone-700" role="status">
          Bloqueaste las notificaciones para esta web. Para activarlas, abre los ajustes del sitio
          en tu navegador (el icono junto a la dirección), permite las notificaciones y recarga la
          página.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="text-sm text-stone-700" role="status">
          Este navegador no permite notificaciones push. En Android usa Chrome; en iPhone necesitas
          iOS 16.4 o superior con la app instalada en la pantalla de inicio.
        </p>
      )}
      {action}
    </Card>
  );
}
