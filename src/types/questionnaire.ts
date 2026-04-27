export type AnswerType = 'singleLine' | 'multiLine' | 'singleSelect' | 'multiSelect' | 'file';

export interface QuestionItem {
  id: string;
  text: string;
  order: number;
  answerType: AnswerType;
  options?: string[];
  required?: boolean;
}

export interface QuestionnaireResponse {
  questionId: string;
  value: string | string[] | File | null;
}

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  singleLine: 'Single-Line Text',
  multiLine: 'Multi-Line Text',
  singleSelect: 'Single Select (Dropdown)',
  multiSelect: 'Multi Select (Checkboxes)',
  file: 'File Attachment'
};

export const validateQuestionnaireStructure = (questionnaire: QuestionItem[]): string[] => {
  const errors: string[] = [];
  
  questionnaire.forEach((question, index) => {
    // Validate answer type
    const validAnswerTypes: AnswerType[] = ['singleLine', 'multiLine', 'singleSelect', 'multiSelect', 'file'];
    if (!validAnswerTypes.includes(question.answerType)) {
      errors.push(`Question ${index + 1}: Invalid answer type "${question.answerType}"`);
    }
    
    // Validate options for select types
    if (question.answerType === 'singleSelect' || question.answerType === 'multiSelect') {
      if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
        errors.push(`Question ${index + 1}: Options are required for ${question.answerType} questions`);
      }
    }
    
    // Validate no options for non-select types
    if (['singleLine', 'multiLine', 'file'].includes(question.answerType)) {
      if (question.options && question.options.length > 0) {
        errors.push(`Question ${index + 1}: Options should not be provided for ${question.answerType} questions`);
      }
    }
    
    // Validate question text
    if (!question.text || question.text.trim().length === 0) {
      errors.push(`Question ${index + 1}: Question text is required`);
    }
  });
  
  return errors;
};