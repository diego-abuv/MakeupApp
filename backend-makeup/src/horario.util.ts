import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { FUSO_HORARIO, INTERVALO_SLOTS_MINUTOS } from './horario.config';

export function parseDataLocal(data: string, hora: string): Date {
  const [hh, mm] = hora.split(':').map((parte) => parte.padStart(2, '0'));
  return fromZonedTime(`${data}T${hh}:${mm}:00`, FUSO_HORARIO);
}

export function formatarHoraLocal(date: Date): string {
  return formatInTimeZone(date, FUSO_HORARIO, 'HH:mm');
}

export { FUSO_HORARIO, INTERVALO_SLOTS_MINUTOS };
