import { Location } from '../../generated/prisma/client';

export class LocationIngestedEvent {
  constructor(public readonly location: Location) {}
}
