import { getMethod, readBody, getQuery, createError } from 'h3';
import { requireAppToken } from '../utils/auth';
import { getMaterials } from '../utils/materialsStore';
import {
  CURRICULUM,
  findLesson,
  totalLessonCount,
  type LearningPath,
} from '../utils/curriculum';
import {
  getProgress,
  saveProgress,
  bumpStreak,
  type LearningProgress,
} from '../utils/learningStore';

// Merge each lesson with its resolved prose (from materialsStore by materialId,
// or the lesson's inline content). Returns curriculum enriched for the client.
function resolveCurriculum(): LearningPath[] {
  const materials = getMaterials();
  const byId = new Map(materials.map((m) => [m.id, m]));
  return CURRICULUM.map((path) => ({
    ...path,
    modules: path.modules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((lesson) => {
        const mat = lesson.materialId ? byId.get(lesson.materialId) : undefined;
        return {
          ...lesson,
          content: lesson.content ?? mat?.content ?? '',
          tags: mat?.tags ?? [],
          level: mat?.level ?? path.level,
        };
      }),
    })),
  }));
}

function computeStats(progress: LearningProgress) {
  const total = totalLessonCount();
  const done = progress.completed.length;
  const quizzesTaken = Object.keys(progress.quiz).length;
  const quizVals = Object.values(progress.quiz);
  const avgQuizPct = quizVals.length
    ? Math.round(
        (quizVals.reduce((s, q) => s + (q.total ? q.score / q.total : 0), 0) /
          quizVals.length) *
          100,
      )
    : 0;
  return {
    totalLessons: total,
    completedLessons: done,
    percent: total ? Math.round((done / total) * 100) : 0,
    quizzesTaken,
    avgQuizPct,
    streak: progress.streak.count,
    lastLessonId: progress.lastLessonId,
  };
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  // ---- GET: public read (curriculum + progress + stats) ----
  if (method === 'GET') {
    const progress = await getProgress();
    return {
      success: true,
      paths: resolveCurriculum(),
      progress,
      stats: computeStats(progress),
    };
  }

  // ---- Writes are token-gated (personal data) ----
  requireAppToken(event);

  if (method === 'POST') {
    const body = await readBody<{
      action?: 'complete' | 'uncomplete' | 'quiz' | 'visit';
      lessonId?: string;
      score?: number;
      total?: number;
    }>(event);

    const action = body?.action;
    const lessonId = (body?.lessonId || '').trim();
    if (!action || !lessonId) {
      throw createError({ statusCode: 400, statusMessage: 'action & lessonId wajib diisi.' });
    }
    if (!findLesson(lessonId)) {
      throw createError({ statusCode: 404, statusMessage: 'Lesson tidak ditemukan.' });
    }

    const progress = await getProgress();

    switch (action) {
      case 'complete': {
        if (!progress.completed.includes(lessonId)) progress.completed.push(lessonId);
        progress.lastLessonId = lessonId;
        progress.streak = bumpStreak(progress.streak);
        break;
      }
      case 'uncomplete': {
        progress.completed = progress.completed.filter((id) => id !== lessonId);
        break;
      }
      case 'visit': {
        progress.lastLessonId = lessonId;
        progress.streak = bumpStreak(progress.streak);
        break;
      }
      case 'quiz': {
        const score = Number(body?.score);
        const total = Number(body?.total);
        if (!isFinite(score) || !isFinite(total) || total <= 0 || score < 0 || score > total) {
          throw createError({ statusCode: 400, statusMessage: 'Skor kuis tidak valid.' });
        }
        progress.quiz[lessonId] = { score, total, at: new Date().toISOString().slice(0, 10) };
        progress.streak = bumpStreak(progress.streak);
        break;
      }
      default:
        throw createError({ statusCode: 400, statusMessage: 'Aksi tidak dikenal.' });
    }

    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);
    return { success: true, progress, stats: computeStats(progress) };
  }

  throw createError({ statusCode: 405, statusMessage: 'Method tidak didukung.' });
});
