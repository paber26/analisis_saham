import { defineEventHandler } from 'h3';
import { buildInsights } from '../../utils/simInsights';

export default defineEventHandler(async () => buildInsights());
