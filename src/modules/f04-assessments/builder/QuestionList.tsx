import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DraftQuestion } from './model'
import { QuestionCard } from './QuestionCard'

interface ListProps {
  questions: DraftQuestion[]
  readOnly: boolean
  showProblems: boolean
  aiScoring: boolean
  onPatch: (key: string, patch: Partial<DraftQuestion>) => void
  onRemove: (key: string) => void
  onMove: (from: string, to: string) => void
}

function SortableItem({ q, index, ...rest }: Omit<ListProps, 'questions' | 'onMove'> & { q: DraftQuestion; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.key, disabled: rest.readOnly })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}>
      <QuestionCard
        q={q}
        index={index}
        readOnly={rest.readOnly}
        showProblems={rest.showProblems}
        aiScoring={rest.aiScoring}
        onPatch={(patch) => rest.onPatch(q.key, patch)}
        onRemove={() => rest.onRemove(q.key)}
        handleProps={{ ...attributes, ...listeners }}
      />
    </li>
  )
}

/** Sortable question cards: drag with the pointer, or focus the handle and use Space + arrow keys. */
export function QuestionList({ questions, onMove, ...rest }: ListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={questions.map((q) => q.key)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-4">
          {questions.map((q, i) => (
            <SortableItem key={q.key} q={q} index={i} {...rest} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
