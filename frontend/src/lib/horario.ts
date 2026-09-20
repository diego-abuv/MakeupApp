import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const FUSO_HORARIO = "America/Sao_Paulo";

export function formatarDataExtenso(data: string): string {
  return formatInTimeZone(
    fromZonedTime(`${data}T00:00:00`, FUSO_HORARIO),
    FUSO_HORARIO,
    "EEEE, dd 'de' MMMM",
  );
}

export function formatarDataCurta(data: string): string {
  return formatInTimeZone(
    fromZonedTime(`${data}T00:00:00`, FUSO_HORARIO),
    FUSO_HORARIO,
    "dd/MM/yyyy",
  );
}

export function formatarHorario(iso: string): string {
  return formatInTimeZone(new Date(iso), FUSO_HORARIO, "HH:mm");
}

export function hojeLocal(): string {
  return formatInTimeZone(new Date(), FUSO_HORARIO, "yyyy-MM-dd");
}

export function proximosDias(qtde: number): string[] {
  const dias: string[] = [];
  const hoje = hojeLocal();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  for (let i = 0; i < qtde; i++) {
    const d = new Date(Date.UTC(ano, mes - 1, dia + i));
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

export function diasDoMes(ano: number, mes: number): string[] {
  const dias: string[] = [];
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let dia = 1; dia <= total; dia++) {
    dias.push(
      `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    );
  }
  return dias;
}

export function rotuloMes(ano: number, mes: number): string {
  return formatInTimeZone(
    fromZonedTime(`${ano}-${String(mes).padStart(2, "0")}-01T00:00:00`, FUSO_HORARIO),
    FUSO_HORARIO,
    "MMMM 'de' yyyy",
  );
}

export function rotuloSemana(data: string): string {
  return formatInTimeZone(
    fromZonedTime(`${data}T00:00:00`, FUSO_HORARIO),
    FUSO_HORARIO,
    "EEE",
  );
}

export function dataHoraLocal(data: string, hora: string): string {
  return `${data}T${hora}`;
}

export function horaAtualSaoPaulo(): string {
  return formatInTimeZone(new Date(), FUSO_HORARIO, "HH:mm");
}

export function horaJaPassada(data: string, hora: string): boolean {
  if (data !== hojeLocal()) return false;
  return hora <= horaAtualSaoPaulo();
}

export function paraHoraSaoPauloLocal(value: string): string {
  const fusoNavegador =
    new Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const instante = fromZonedTime(value, fusoNavegador);
  return formatInTimeZone(instante, FUSO_HORARIO, "yyyy-MM-dd'T'HH:mm");
}
