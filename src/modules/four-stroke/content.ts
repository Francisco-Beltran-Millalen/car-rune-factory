// Fichas de las piezas del ciclo de 4 tiempos (CONTRATOS 4.4). Por variante:
// OHV suma varilla y balancín; DOHC suma la correa dentada.

import type { PartInfo } from '../../core/types.ts';
import { VARIANTS, type FourStrokeVariant } from './constants.ts';

const CYLINDER: PartInfo = {
  name: 'Cilindro',
  what: 'El tubo donde sube y baja el pistón.',
  why: 'Encierra el gas: sin él no hay compresión ni expansión.',
  how: 'El pistón se desliza sellado por los anillos; arriba está la culata con las válvulas.',
  failures: ['Compresión baja → anillos gastados o válvula quemada', 'Golpeteo → válvula chocando con el pistón'],
};

const PISTON: PartInfo = {
  name: 'Pistón',
  what: 'El émbolo que recibe la presión de la combustión.',
  why: 'Convierte la presión del gas en movimiento del cigüeñal.',
  how: 'Sube en compresión, la chispa lo empuja hacia abajo en expansión y transmite la fuerza por la biela.',
  failures: ['Fuga por los anillos', 'Choque con una válvula fuera de punto'],
};

const RINGS: PartInfo = {
  name: 'Anillos',
  what: 'Las argollas que sellan el pistón contra la pared del cilindro.',
  why: 'Si no sellan, la compresión se escapa al cárter y el motor pierde fuerza.',
  how: 'La presión los aprieta contra la pared; con el desgaste la luz crece y sopla cada vez más.',
  failures: ['Compresión baja proporcional al desgaste (la prueba de compresión la delata)'],
};

const ROD: PartInfo = {
  name: 'Biela',
  what: 'La barra que une el pistón con el cigüeñal.',
  why: 'Transforma el vaivén del pistón en giro.',
  how: 'Su extremo chico toma el pistón por el perno y el grande abraza la muñequilla del cigüeñal.',
  failures: ['Golpeteo por cojinetes gastados'],
};

const CRANK: PartInfo = {
  name: 'Cigüeñal',
  what: 'El eje con manivelas que recoge el trabajo de los pistones.',
  why: 'Es la salida de potencia del motor y manda el tren de distribución.',
  how: 'Cada muñequilla está a 180° de la siguiente en un 4 en línea; su giro se mide en grados (0–720 por ciclo).',
  failures: ['Chavetero ovalado o chaveta cortada por el perno flojo'],
};

const HEAD: PartInfo = {
  name: 'Culata',
  what: 'La tapa que cierra los cilindros por arriba.',
  why: 'Aloja las válvulas, los conductos y la bujía.',
  how: 'Forma la cámara de combustión; en un motor de interferencia el pistón y las válvulas comparten el mismo espacio.',
  failures: ['Válvulas dobladas al chocar con el pistón'],
};

const INTAKE_VALVE: PartInfo = {
  name: 'Válvula de admisión',
  what: 'La compuerta que deja entrar la mezcla.',
  why: 'Sin ella el cilindro no se llena de aire y combustible.',
  how: 'Abre antes del PMS (cruce) y cierra después del PMI; su alzada máxima es 9 mm.',
  failures: ['Válvula quemada → fuga y compresión baja', 'Fuera de punto → choque con el pistón'],
};

const EXHAUST_VALVE: PartInfo = {
  name: 'Válvula de escape',
  what: 'La compuerta que deja salir los gases quemados.',
  why: 'Vacía el cilindro para que entre mezcla fresca.',
  how: 'Abre antes del PMI y cierra después del PMS, en el cruce con la admisión.',
  failures: ['Válvula quemada → fuga al escape y pérdida de compresión', 'Fuera de punto → choque con el pistón'],
};

const CAMSHAFT: PartInfo = {
  name: 'Árbol de levas',
  what: 'El eje con levas que abre y cierra las válvulas.',
  why: 'Sincroniza la respiración del motor con el giro del cigüeñal.',
  how: 'Gira a la mitad de las vueltas del cigüeñal; cada leva empuja su válvula en el momento justo.',
  failures: ['Desfase por cadena estirada, dientes saltados o chaveta cortada'],
};

const SPARK_PLUG: PartInfo = {
  name: 'Bujía',
  what: 'El electrodo que enciende la mezcla.',
  why: 'Sin chispa no hay combustión: el motor gira pero no entrega trabajo.',
  how: 'Salta el arco unos grados antes del PMS de compresión (avance); la llama tarda ~50° en quemar todo.',
  failures: ['Sin chispa el ciclo se queda sin combustión (trabajo neto casi cero)'],
};

const INTAKE_PORT: PartInfo = {
  name: 'Conducto de admisión',
  what: 'El pasaje que lleva la mezcla hasta la válvula.',
  why: 'Conduce el aire medido hacia el cilindro.',
  how: 'Termina en el asiento de la válvula; su presión es la del múltiple.',
  failures: ['Entrada de aire no medido → mezcla pobre'],
};

const EXHAUST_PORT: PartInfo = {
  name: 'Conducto de escape',
  what: 'El pasaje que evacua los gases quemados.',
  why: 'Saca del cilindro los gases que ya no sirven.',
  how: 'Trabaja contra la contrapresión del escape (1,10 bar absolutos de referencia).',
  failures: ['Contrapresión alta → el cilindro no se vacía bien'],
};

const PUSHROD: PartInfo = {
  name: 'Varilla de empuje',
  what: 'La varilla que lleva el movimiento de la leva al balancín.',
  why: 'Permite tener la leva en el bloque y las válvulas arriba (OHV).',
  how: 'La leva empuja el taqué, el taqué empuja la varilla y la varilla mueve el balancín.',
  failures: ['Juego de taqués mal ajustado → menos alzada y tic-tic'],
};

const ROCKER: PartInfo = {
  name: 'Balancín',
  what: 'La palanca que invierte el empuje de la varilla sobre la válvula.',
  why: 'Abre la válvula con la geometría del motor OHV.',
  how: 'Basculla sobre un eje: la varilla empuja un extremo y el otro baja la válvula.',
  failures: ['Juego de taqués (lash) → alzada menor y ruido'],
};

const CRANK_BOLT: PartInfo = {
  name: 'Perno del cigüeñal',
  what: 'El perno que aprieta el piñón de la distribución contra el cigüeñal.',
  why: 'Mantiene el piñón firme: si se afloja, todo el par pasa por la chaveta.',
  how: 'Con el perno flojo el piñón trabaja suelto y gasta el chavetero (acelerado ×1000 en el laboratorio).',
  failures: ['Chavetero ovalado y, al final, chaveta cortada'],
};

const CRANK_KEY: PartInfo = {
  name: 'Chaveta',
  what: 'La pieza que traba el piñón contra el cigüeñal.',
  why: 'Sincroniza el giro de la distribución con el del cigüeñal.',
  how: 'Se aloja en el chavetero; si el chavetero se ovala, el piñón baila y la leva se atrasa.',
  failures: ['Chavetero ovalado → desfase variable con la carga', 'Chaveta cortada → el piñón resbala y la leva queda atrás'],
};

const CRANK_SPROCKET: PartInfo = {
  name: 'Piñón del cigüeñal',
  what: 'La rueda dentada que mueve la cadena desde el cigüeñal.',
  why: 'Es el punto de mando de la distribución.',
  how: 'Tiene 21 dientes: un diente de la leva equivale a 17,14° de cigüeñal.',
  failures: ['Juego sobre el cigüeñal por el chavetero gastado'],
};

const TIMING_CHAIN: PartInfo = {
  name: 'Cadena de distribución',
  what: 'La cadena que une el piñón del cigüeñal con el de la leva.',
  why: 'Mantiene sincronizados el pistón y las válvulas.',
  how: 'Con el uso se estira, la leva se atrasa y el punto ya no coincide.',
  failures: ['Atraso de 6° con la cadena estirada', 'Holgura excesiva → salta un diente'],
};

const TIMING_BELT: PartInfo = {
  name: 'Correa dentada',
  what: 'La correa que mueve la leva en los motores modernos.',
  why: 'Reemplaza a la cadena: más silenciosa, pero se cambia por kilometraje.',
  how: 'Los dientes traban en los piñones; el desgaste atrasa la leva y con carga puede cortarse.',
  failures: ['Atraso de 3° con la correa gastada', 'A 0,9 de desgaste y con carga se corta'],
};

const TENSIONER: PartInfo = {
  name: 'Tensor',
  what: 'El mecanismo que mantiene la cadena (o correa) tensa.',
  why: 'Sin tensión la cadena golpetea y puede saltar de diente.',
  how: 'Puede ser de resorte o hidráulico: este último usa la presión de aceite, por eso al partir en frío tarda en tensar.',
  failures: ['Cadena floja → ruido y golpeteo', 'Sin presión de aceite el tensor hidráulico no tensa'],
};

const CHAIN_GUIDE: PartInfo = {
  name: 'Guía de la cadena',
  what: 'El patín plástico que ordena el recorrido de la cadena.',
  why: 'Evita que la cadena golpee la tapa y la guía.',
  how: 'Va fija al bloque; cuando se parte deja restos de plástico en el cárter.',
  failures: ['Rota → más holgura y trozos de plástico en el aceite'],
};

const CAM_SPROCKET: PartInfo = {
  name: 'Piñón de la leva',
  what: 'La rueda dentada que corona el árbol de levas.',
  why: 'Recibe el movimiento de la cadena o correa.',
  how: 'Tiene el doble de dientes que el del cigüeñal (42) y una marca de sincronización que debe coincidir con la referencia fija.',
  failures: ['Marca fuera de referencia → distribución fuera de punto'],
};

export function createParts(variant: FourStrokeVariant): Readonly<Record<string, PartInfo>> {
  const parts: Record<string, PartInfo> = {
    piston: PISTON,
    rings: RINGS,
    rod: ROD,
    crank: CRANK,
    head: HEAD,
    intakeValve: INTAKE_VALVE,
    exhaustValve: EXHAUST_VALVE,
    camshaft: CAMSHAFT,
    sparkPlug: SPARK_PLUG,
    intakePort: INTAKE_PORT,
    exhaustPort: EXHAUST_PORT,
    crankBolt: CRANK_BOLT,
    crankKey: CRANK_KEY,
    crankSprocket: CRANK_SPROCKET,
    tensioner: TENSIONER,
    chainGuide: CHAIN_GUIDE,
    camSprocket: CAM_SPROCKET,
  };
  for (let i = 1; i <= 4; i++) parts[`cyl${i}`] = CYLINDER;
  if (VARIANTS[variant].hasRocker) {
    parts['pushrod'] = PUSHROD;
    parts['rocker'] = ROCKER;
  }
  parts['timingChain'] = TIMING_CHAIN;
  if (VARIANTS[variant].hasBelt) parts['timingBelt'] = TIMING_BELT;
  return parts;
}
