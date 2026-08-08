export const SHIFT_PROTOCOL_RESOURCES = Object.freeze([
  {
    id: 'opening-protocol',
    zone: 'shift',
    recordType: 'apertura',
    label: 'Ver protocolo de apertura',
    title: 'Protocolo de apertura',
    description: 'Pasos oficiales para preparar el centro antes del turno.',
    version: 'v0',
    url: 'https://docs.google.com/document/d/1Y1m3lGIKEk5KFyIKLNLNs-VcrKnWzBOpmU_xjDKy6RE/edit',
  },
  {
    id: 'closing-protocol',
    zone: 'shift',
    recordType: 'cierre',
    label: 'Ver protocolo para finalizar turno',
    title: 'Protocolo para finalizar turno',
    description: 'Pasos oficiales para dejar el centro preparado al terminar.',
    version: 'v0',
    url: 'https://docs.google.com/document/d/1e5Wumc6JS3v34duSZzHQHXpzPDv8P8KjneuxgnzT0xk/edit',
  },
  {
    id: 'class-handbook',
    zone: 'resources',
    label: 'Handbook de Clases',
    title: 'Handbook de Clases',
    description: 'Criterios y forma de trabajar las clases EVO.',
    status: 'En implantación',
    url: 'https://docs.google.com/document/d/1VLdStqgQp-IPvZSwCFPyCyA0ZGp9VhEqYEacducAH1g/edit',
  },
  {
    id: 'student-records',
    zone: 'resources',
    label: 'Fichas de alumnos',
    title: 'Fichas de alumnos',
    description: 'Carpeta oficial de fichas de alumnos de 2026.',
    status: 'Vigente',
    url: 'https://drive.google.com/drive/folders/1f0kg4D3B7dxQEq0V2Mj-RRm0-FeQBQGd',
  },
  {
    id: 'student-record-template',
    zone: 'resources',
    label: 'Plantilla de ficha',
    title: 'Plantilla de ficha',
    description: 'Plantilla oficial para incorporar a una persona nueva.',
    status: 'En prueba',
    url: 'https://docs.google.com/document/d/1_d74cXPuuvtzhS43usOeVcxpJ330szYZOLOM1j0l_T8/edit',
  },
  {
    id: 'new-student-protocol',
    zone: 'resources',
    label: 'Protocolo de alumno nuevo',
    title: 'Protocolo de alumno nuevo',
    description: 'Qué debe hacer el entrenador cuando llega una persona nueva.',
    status: 'En prueba',
    url: 'https://docs.google.com/document/d/14pzOKGHRKoM0pY7wQcBU3jxkR5xeWCSF/edit',
  },
  {
    id: 'operational-rollout-phase-1',
    zone: 'resources',
    label: 'Implantación Operativa · Fase 1',
    title: 'Implantación Operativa · Fase 1',
    description: 'Documento de apoyo para aplicar esta primera fase con el equipo.',
    status: 'Borrador para comunicar',
    url: 'https://docs.google.com/document/d/1b8E20TLbWhwMq34aPz1RD7IUhNZ_luk4ob2O1P7iXJU/edit',
  },
])

export const SHIFT_PROTOCOL_LINKS = Object.freeze(
  SHIFT_PROTOCOL_RESOURCES.filter((resource) => resource.zone === 'shift'),
)

export const EVO_OPERATIONAL_RESOURCES = Object.freeze(
  SHIFT_PROTOCOL_RESOURCES.filter((resource) => resource.zone === 'resources'),
)

export function getShiftProtocol(recordType) {
  return SHIFT_PROTOCOL_LINKS.find((resource) => resource.recordType === recordType) || null
}
