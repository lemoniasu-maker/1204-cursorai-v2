import React, { useMemo, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from '@dnd-kit/core';

// API Key 가져오기 (Vite 환경변수)
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// AI 피드백 요청 함수
const getAIFeedback = async (dividend, divisor, estimate, actualQuotient) => {
  if (!API_KEY || API_KEY === 'undefined' || API_KEY.trim() === '') {
    return null;
  }

  const estimateProduct = estimate * divisor;
  const isOneDigitAnswer = actualQuotient < 10;

  const prompt = `학생이 ${dividend} ÷ ${divisor} 문제를 풀고 있습니다.
학생이 어림한 값은 ${estimate}입니다.
정답은 ${actualQuotient}입니다.

학생이 어림한 ${estimate}에 나누는 수 ${divisor}를 곱하면 ${estimateProduct}가 됩니다.
이것을 나누어지는 수 ${dividend}와 비교해서 피드백을 주세요.

[작성 규칙]
${isOneDigitAnswer ? 
`1. 정답이 한 자리 수(10보다 작음)이므로, 어림한 값이 정답과 1~2 정도 차이면 잘한 것입니다.
2. 차이가 2 이하면 잘 어림했다고 칭찬해주세요.
3. 차이가 크면 "아쉽네요."로 시작하면서, "어림한 몫 × 나누는 수"의 결과가 나누어지는 수와 비교해 힌트를 주세요.` :
`1. 어림하기는 "몇십" 단위로 맞추는 것이 목표입니다. 학생이 어림한 값을 10으로 나눈 몫과 정답을 10으로 나눈 몫이 같으면 매우 잘한 것입니다.
   예시: 정답이 34일 때 30~39 범위로 어림하면 잘한 것입니다.
2. 몇십 단위로 잘 어림했다면 크게 칭찬해주세요.
3. 몇십 단위를 벗어났다면 "아쉽네요."로 시작하면서, "어림한 몫 × 나누는 수"의 결과가 나누어지는 수보다 크거나 작다는 것을 언급하며 힌트를 주세요.`}
4. 존댓말을 쓰고, 이모지(😊)를 하나 정도 사용해 주세요.
5. 답변은 3문장을 넘기지 마세요.
6. 절대 정답을 직접적으로 말하지 마세요.

[좋은 답변 예시]
${isOneDigitAnswer ?
`- "잘 어림했어요! 2에 4를 곱하면 8이 되니까 딱 맞네요. 훌륭해요! 👍"
- "아주 가까워요! 어림하기를 잘하네요. 😊"
- "아쉽네요. 5에 2를 곱하면 10이 되어서 8보다 크네요. 5보다 작은 수로 생각해보면 어떨까요? 😊"` :
`- "와, 정말 잘 어림했어요! 30에 2를 곱하면 60이 되니까 68과 가까워요. 훌륭해요! 👍"
- "30대로 잘 생각했어요! 어림하기를 정말 잘하네요. 😊"
- "아쉽네요. 40에 3을 곱하면 120이 되어서 132보다 작네요. 40보다 조금 더 큰 수로 생각해보면 어떨까요? 😊"
- "아쉽네요. 60에 2를 곱하면 120이 되어서 85보다 크네요. 60보다 작은 수수로 다시 생각해봐요! 😊"`}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 친절한 초등학교 수학 선생님입니다. 짧고 격려하는 말투로 답변합니다.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI 피드백 오류:', error);
    return null;
  }
};

const createBlocks = (dividend) => {
  const hundreds = Math.floor(dividend / 100);
  const tens = Math.floor((dividend % 100) / 10);
  const ones = dividend % 10;
  const blocks = [];
  let id = 1;
  for (let i = 0; i < hundreds; i += 1) {
    blocks.push({ id: `h${id++}`, type: 'hundred', containerId: 'source' });
  }
  for (let i = 0; i < tens; i += 1) {
    blocks.push({ id: `t${id++}`, type: 'ten', containerId: 'source' });
  }
  for (let i = 0; i < ones; i += 1) {
    blocks.push({ id: `o${id++}`, type: 'one', containerId: 'source' });
  }
  return blocks;
};

const getBlockValue = (type) => {
  if (type === 'hundred') return 100;
  if (type === 'ten') return 10;
  return 1;
};

// 세로셈 계산 단계 생성
const computeLongDivisionSteps = (dividend, divisor) => {
  if (!divisor || !dividend) return [];
  const dividendStr = String(dividend);
  const digits = dividendStr.split('').map((d) => Number(d));
  let remainder = 0;
  const steps = [];
  
  digits.forEach((digit, idx) => {
    const current = remainder * 10 + digit;
    const qDigit = Math.floor(current / divisor);
    const product = qDigit * divisor;
    const nextRemainder = current - product;
    steps.push({
      position: idx,
      bringDown: current,
      digit,
      qDigit,
      product,
      remainder: nextRemainder,
    });
    remainder = nextRemainder;
  });
  return steps;
};

const Block = ({ id, type, onClick, isHammerMode }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    // 터치 기기(크롬북 터치스크린, 휴대폰, 태블릿)에서 블록을 끌 때 화면 스크롤 대신 드래그로 처리
    touchAction: isHammerMode ? 'manipulation' : 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  };

  // 이미지 경로와 크기 설정
  const getBlockConfig = () => {
    if (type === 'hundred') {
      return { src: '/image/hundred.png', size: 'w-14 h-14 sm:w-16 sm:h-16', label: '100' };
    }
    if (type === 'ten') {
      return { src: '/image/ten.png', size: 'w-11 h-11 sm:w-12 sm:h-12', label: '10' };
    }
    return { src: '/image/one.png', size: 'w-8 h-8 sm:w-9 sm:h-9', label: '1' };
  };

  const config = getBlockConfig();

  const handleClick = () => {
    if (onClick) onClick(id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isHammerMode ? {} : listeners)}
      {...attributes}
      onClick={handleClick}
      className={`relative select-none ${isDragging ? '' : 'transition-transform'} ${config.size} ${
        isDragging ? 'scale-110 ring-4 ring-offset-2 ring-sky-400 z-10 drop-shadow-lg' : 'drop-shadow-md'
      }`}
    >
      <img 
        src={config.src} 
        alt={`${config.label} 모형`}
        className="w-full h-full object-contain pointer-events-none"
        draggable="false"
      />
    </div>
  );
};

const Plate = ({ id, label, children, highlight }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[80px] sm:min-h-[120px] rounded-2xl border-4 border-dashed bg-white/80 flex flex-col p-3 gap-2 transition-colors ${
        isOver ? 'border-sky-500 bg-sky-50' : 'border-pastelBlue'
      } ${highlight ? 'ring-4 ring-emerald-400' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-base sm:text-lg font-bold text-sky-800">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
};

const SourceArea = ({ blocks, onBlockClick, isHammerMode }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'source',
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl bg-white/80 border-4 px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 transition-colors ${
        isOver ? 'border-sky-500 bg-sky-50' : 'border-pastelPink'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg sm:text-xl font-bold text-pink-700">수모형 상자</span>
        <span className="text-xs sm:text-sm text-pink-700/80">
          위 블록을 아래 접시에 골고루 나누어 담아 보세요.
        </span>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {blocks.map((b) => (
          <Block
            key={b.id}
            id={b.id}
            type={b.type}
            onClick={onBlockClick}
            isHammerMode={isHammerMode}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-4 text-xs sm:text-sm text-slate-700">
        <div className="flex items-center gap-1">
          <img src="/image/hundred.png" alt="백 모형" className="w-5 h-5 object-contain" />
          <span>백 모형 (100)</span>
        </div>
        <div className="flex items-center gap-1">
          <img src="/image/ten.png" alt="십 모형" className="w-4 h-4 object-contain" />
          <span>십 모형 (10)</span>
        </div>
        <div className="flex items-center gap-1">
          <img src="/image/one.png" alt="일 모형" className="w-3 h-3 object-contain" />
          <span>일 모형 (1)</span>
        </div>
      </div>
    </div>
  );
};

// 세로셈 표 형식 컴포넌트
const LongDivisionGrid = ({ dividend, divisor, steps, completedSteps }) => {
  const digits = String(dividend).split('').map((d) => Number(d));
  const numDigits = digits.length;
  
  // 몫의 각 자릿수
  const quotientDigits = steps.map((s) => s.qDigit);
  
  // 단계별 색상 정의
  const getStepColor = (stepIdx) => {
    if (numDigits === 3) {
      // 3자리: 0=백(초록), 1=십(파란), 2=일(빨간)
      if (stepIdx === 0) return 'text-emerald-600';
      if (stepIdx === 1) return 'text-blue-600';
      if (stepIdx === 2) return 'text-red-600';
    } else if (numDigits === 2) {
      // 2자리: 0=십(초록), 1=일(파란)
      if (stepIdx === 0) return 'text-emerald-600';
      if (stepIdx === 1) return 'text-blue-600';
    } else {
      // 1자리: 0=일(초록)
      return 'text-emerald-600';
    }
    return 'text-slate-900';
  };
  
  // 현재 진행 중인 단계의 색상
  const currentStepIdx = completedSteps > 0 ? completedSteps - 1 : -1;
  const currentStepColor = currentStepIdx >= 0 ? getStepColor(currentStepIdx) : 'text-slate-900';
  
  // 세로셈 셀 스타일 - 점선으로 구분
  const cellStyle = 'w-12 min-h-[3rem] sm:w-14 sm:min-h-[3.5rem] flex items-center justify-center text-lg sm:text-xl font-bold border-l border-dashed border-slate-300';
  const emptyCellStyle = 'w-12 min-h-[3rem] sm:w-14 sm:min-h-[3.5rem] flex items-center justify-center text-lg sm:text-xl font-bold border-l border-dashed border-slate-200 text-slate-300';
  const spacerStyle = 'w-12 sm:w-14';
  const emptySpacerStyle = 'w-12 sm:w-14 border-l border-dashed border-slate-300';
  
  return (
    <div className="flex flex-col items-start gap-0">
      {/* 몫 행 (맨 위) */}
      <div className="flex items-center">
        <div className="w-12 sm:w-14 border-l border-dashed border-slate-300" /> {/* 나누는 수 자리 빈 공간 */}
        <div className="w-6 sm:w-8" /> {/* 괄호 자리 빈 공간 */}
        {digits.map((_, idx) => (
          <div
            key={`q-${idx}`}
            className={completedSteps > idx ? cellStyle : emptyCellStyle}
          >
            {completedSteps > idx && quotientDigits[idx] !== undefined ? String(quotientDigits[idx]) : ''}
          </div>
        ))}
      </div>
      
      {/* 나눗셈 기호와 나눠지는 수 행 */}
      <div className="flex items-center">
        {/* 나누는 수 (현재 단계 색상 적용, 점선 추가) */}
        <div className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-lg sm:text-xl font-bold border-l border-dashed border-slate-300 ${currentStepColor}`}>
          {divisor}
        </div>
        {/* 괄호 기호 ) (위에 실선 추가) */}
        <div className="w-6 sm:w-8 h-12 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-bold text-slate-700 border-t-2 border-slate-700">
          )
        </div>
        {/* 나눠지는 수 각 자릿수 (위에 실선) */}
        {digits.map((d, idx) => {
          // 백의 자리(첫 번째 자릿수)이고 완료된 단계가 있을 때만 색상 적용
          const isFirstDigitWithProgress = idx === 0 && completedSteps > 0;
          const digitColor = isFirstDigitWithProgress ? getStepColor(0) : 'text-slate-900';
          
          return (
            <div
              key={`d-${idx}`}
              className={`w-12 min-h-[3rem] sm:w-14 sm:min-h-[3.5rem] flex items-center justify-center text-lg sm:text-xl font-bold border-l border-slate-300 border-t-2 border-slate-700 ${digitColor}`}
              style={{ 
                borderLeftStyle: 'dashed',
                borderTopStyle: 'solid'
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
      
      {/* 계산 과정 (각 단계별) */}
      {steps.map((step, stepIdx) => {
        if (completedSteps <= stepIdx) return null;
        
        // product와 remainder의 자릿수 계산
        const productStr = String(step.product);
        const productLen = productStr.length;
        
        return (
          <div key={`step-${stepIdx}`} className="flex flex-col">
            {/* 빼는 수 (곱) - 자릿수별로 분리해서 표시 */}
            <div className="flex items-center">
              <div className="w-12 sm:w-14 border-l border-dashed border-slate-300" />
              <div className="w-6 sm:w-8" />
              {digits.map((_, idx) => {
                // product가 시작되는 열 계산 (product 끝이 stepIdx 열에 맞춰짐)
                const productStartCol = stepIdx - (productLen - 1);
                const positionInProduct = idx - productStartCol;
                
                if (positionInProduct >= 0 && positionInProduct < productLen) {
                  const digitChar = productStr[positionInProduct];
                  return (
                    <div key={`sub-${stepIdx}-${idx}`} className={`${cellStyle}`}>
                      {digitChar}
                    </div>
                  );
                }
                return <div key={`sub-${stepIdx}-${idx}`} className={emptySpacerStyle} />;
              })}
              {/* 곱셈식 표시 */}
              <div className="ml-3 text-xs sm:text-sm text-slate-600 whitespace-nowrap flex items-center">
                ← {divisor} × {step.qDigit * Math.pow(10, numDigits - stepIdx - 1)}
              </div>
            </div>
            
            {/* 빼기 선 */}
            <div className="flex items-center">
              <div className="w-12 sm:w-14 border-l border-dashed border-slate-300" />
              <div className="w-6 sm:w-8" />
              {digits.map((_, idx) => {
                // 모든 자릿수에 빼기 선 표시
                return (
                  <div key={`line-${stepIdx}-${idx}`} className={`${emptySpacerStyle} border-b-2 border-dashed border-slate-400`} />
                );
              })}
            </div>
            
            {/* 나머지 + 다음 자리 내림 */}
            <div className="flex items-center">
              <div className="w-12 sm:w-14 border-l border-dashed border-slate-300" />
              <div className="w-6 sm:w-8" />
              {digits.map((_, idx) => {
                // 마지막 단계가 아니면 나머지 + 다음 자리 표시
                if (stepIdx < steps.length - 1) {
                  // 다음 단계의 bringDown을 표시
                  const nextBringDown = steps[stepIdx + 1].bringDown;
                  const nextBringDownStr = String(nextBringDown);
                  const nextLen = nextBringDownStr.length;
                  
                  // bringDown이 끝나는 열 = stepIdx + 1
                  const bringDownStartCol = (stepIdx + 1) - (nextLen - 1);
                  const posInBringDown = idx - bringDownStartCol;
                  
                  if (posInBringDown >= 0 && posInBringDown < nextLen) {
                    const digitChar = nextBringDownStr[posInBringDown];
                    
                    // 전체 숫자(나머지 + 내림)를 다음 단계 색상으로 적용
                    const textColor = getStepColor(stepIdx + 1);
                    
                    return (
                      <div key={`rem-${stepIdx}-${idx}`} className={`${cellStyle} ${textColor} font-bold`}>
                        {digitChar}
                      </div>
                    );
                  }
                } else {
                  // 마지막 단계: 최종 나머지만 표시
                  const remainderStr = String(step.remainder);
                  const remLen = remainderStr.length;
                  const remStartCol = stepIdx - (remLen - 1);
                  const posInRem = idx - remStartCol;
                  
                  if (posInRem >= 0 && posInRem < remLen) {
                    const digitChar = remainderStr[posInRem];
                    return (
                      <div key={`rem-${stepIdx}-${idx}`} className={`${cellStyle}`}>
                        {digitChar}
                      </div>
                    );
                  }
                }
                return <div key={`rem-${stepIdx}-${idx}`} className={emptySpacerStyle} />;
              })}
            </div>
          </div>
        );
      })}
      
      {/* 최종 나머지 (마지막 단계 완료 시) */}
      {completedSteps === steps.length && steps.length > 0 && (
        <div className="mt-3 text-left pl-12 sm:pl-14">
          <span className="text-sm font-semibold text-slate-700">
            나머지: <span className="text-lg font-bold text-emerald-700">{steps[steps.length - 1].remainder}</span>
          </span>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [equationDividend, setEquationDividend] = useState('');
  const [equationDivisor, setEquationDivisor] = useState('');
  const [estimate, setEstimate] = useState('');
  const [estimateError, setEstimateError] = useState('');
  const [estimateSubmitted, setEstimateSubmitted] = useState(false);
  const [toolMode, setToolMode] = useState('none');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [batchCount, setBatchCount] = useState(1); // 일괄 이동 개수 (기본 1개)

  const [blocks3, setBlocks3] = useState([]);
  const [blocks4, setBlocks4] = useState([]);
  const [step3Completed, setStep3Completed] = useState(false);
  const [step4Started, setStep4Started] = useState(false);
  
  // 히스토리 관리 (실행 취소용)
  const [history3, setHistory3] = useState([]);
  const [history4, setHistory4] = useState([]);

  // AI 피드백 관련 상태
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);

  // API Key 연결 상태 확인
  const hasApiKey = API_KEY && API_KEY !== 'undefined' && API_KEY.trim() !== '';

  const dividendNum = Number(equationDividend);
  const divisorNum = Number(equationDivisor);
  const hasEquation =
    equationDividend !== '' &&
    equationDivisor !== '' &&
    !Number.isNaN(dividendNum) &&
    !Number.isNaN(divisorNum) &&
    divisorNum > 0;

  const problem = useMemo(() => {
    if (hasEquation) {
      return { dividend: dividendNum, divisor: divisorNum };
    }
    return { dividend: 0, divisor: 1 };
  }, [hasEquation, dividendNum, divisorNum]);

  const quotient = useMemo(
    () => (problem.divisor ? Math.floor(problem.dividend / problem.divisor) : 0),
    [problem.dividend, problem.divisor]
  );

  useMemo(() => {
    if (hasEquation) {
      const initialBlocks = createBlocks(dividendNum);
      setBlocks3(initialBlocks);
      setHistory3([]); // 히스토리 초기화
      setEstimate('');
      setEstimateError('');
      setEstimateSubmitted(false);
      setStep3Completed(false);
      setStep4Started(false);
      setBlocks4([]);
      setHistory4([]); // 히스토리 초기화
      setToolMode('none');
      setAiFeedback('');
      setAiFeedbackLoading(false);
    }
  }, [hasEquation, dividendNum, divisorNum]);

  const handleEstimateSubmit = async () => {
    if (!estimate) {
      setEstimateError('어림한 값을 써 보세요.');
      return;
    }
    const num = Number(estimate);
    if (Number.isNaN(num)) {
      setEstimateError('숫자로 어림한 값을 써 보세요.');
      return;
    }
    setEstimateError('');
    setEstimateSubmitted(true);

    // AI 피드백 요청
    if (hasApiKey) {
      setAiFeedbackLoading(true);
      setAiFeedback('');
      const feedback = await getAIFeedback(problem.dividend, problem.divisor, num, quotient);
      setAiFeedbackLoading(false);
      if (feedback) {
        setAiFeedback(feedback);
      } else {
        setAiFeedback('AI 피드백을 가져오는 데 실패했어요. 하지만 계속 진행할 수 있어요!');
      }
    }
  };

  const currentBlocks = step4Started ? blocks4 : blocks3;
  const setCurrentBlocks = step4Started ? setBlocks4 : setBlocks3;
  const currentHistory = step4Started ? history4 : history3;
  const setCurrentHistory = step4Started ? setHistory4 : setHistory3;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const overId = over.id;
    const droppableIds = ['source', ...Array.from({ length: problem.divisor }, (_, i) => `plate-${i}`)];
    if (!droppableIds.includes(overId)) return;

    // 현재 상태를 히스토리에 저장 (최대 20개까지만 유지)
    setCurrentHistory(prev => [...prev.slice(-19), currentBlocks]);

    // batchCount가 1이면 기존 동작 (1개만 이동)
    if (batchCount === 1) {
      setCurrentBlocks((prev) =>
        prev.map((b) => (b.id === active.id ? { ...b, containerId: overId } : b))
      );
      return;
    }

    // batchCount가 2 이상이면 일괄 이동
    const draggedBlock = currentBlocks.find(b => b.id === active.id);
    if (!draggedBlock) return;
    
    // 같은 타입 + 같은 컨테이너에 있는 블록들 찾기
    const sameTypeBlocks = currentBlocks.filter(
      b => b.type === draggedBlock.type && 
           b.containerId === draggedBlock.containerId &&
           b.id !== active.id
    );
    
    // batchCount - 1개 추가 선택 (드래그한 것 포함 총 batchCount개)
    const additionalBlocks = sameTypeBlocks.slice(0, batchCount - 1);
    
    // 모두 이동
    setCurrentBlocks((prev) => prev.map((b) => {
      if (b.id === active.id || additionalBlocks.find(block => block.id === b.id)) {
        return { ...b, containerId: overId };
      }
      return b;
    }));
  };

  const byContainer = useMemo(() => {
    const map = new Map();
    ['source', ...Array.from({ length: problem.divisor }, (_, i) => `plate-${i}`)].forEach((id) =>
      map.set(id, [])
    );
    currentBlocks.forEach((b) => {
      if (!map.has(b.containerId)) map.set(b.containerId, []);
      map.get(b.containerId).push(b);
    });
    return map;
  }, [currentBlocks, problem.divisor]);

  const perPlateCounts = Array.from({ length: problem.divisor }, (_, i) => {
    const items = byContainer.get(`plate-${i}`) ?? [];
    const total = items.reduce((sum, b) => sum + getBlockValue(b.type), 0);
    return { items, total };
  });
  
  // source에 남아있는 블록의 총합 계산
  const sourceItems = byContainer.get('source') ?? [];
  const sourceTotal = sourceItems.reduce((sum, b) => sum + getBlockValue(b.type), 0);
  
  // 나머지 계산
  const remainder = problem.dividend - (quotient * problem.divisor);
  
  // 완료 조건: 모든 접시에 몫만큼 똑같이 나누어지고, source에는 나머지만 남아있는지 확인
  const everySameAndCorrect =
    perPlateCounts.every((p) => p.total === quotient) &&
    perPlateCounts.length > 0 &&
    sourceTotal === remainder &&
    sourceTotal < problem.divisor;

  const handleBlockClick = (blockId) => {
    if (toolMode !== 'hammer') return;

    // 히스토리 저장
    setCurrentHistory(prev => [...prev.slice(-19), currentBlocks]);

    setCurrentBlocks((prev) => {
      const target = prev.find((b) => b.id === blockId);
      if (!target) return prev;
      const others = prev.filter((b) => b.id !== blockId);

      if (target.type === 'hundred') {
        const additions = Array.from({ length: 10 }).map((_, idx) => ({
          id: `${target.id}-t${idx}`,
          type: 'ten',
          containerId: target.containerId,
        }));
        return [...others, ...additions];
      }
      if (target.type === 'ten') {
        const additions = Array.from({ length: 10 }).map((_, idx) => ({
          id: `${target.id}-o${idx}`,
          type: 'one',
          containerId: target.containerId,
        }));
        return [...others, ...additions];
      }
      return prev;
    });
  };

  const handleMergeAll = () => {
    // 히스토리 저장
    setCurrentHistory(prev => [...prev.slice(-19), currentBlocks]);

    const containers = ['source', ...Array.from({ length: problem.divisor }, (_, i) => `plate-${i}`)];
    const nextBlocks = [];

    containers.forEach((cid) => {
      const inContainer = currentBlocks.filter((b) => b.containerId === cid);
      let hundredCount = inContainer.filter((b) => b.type === 'hundred').length;
      let tenCount = inContainer.filter((b) => b.type === 'ten').length;
      let oneCount = inContainer.filter((b) => b.type === 'one').length;

      const newTenFromOnes = Math.floor(oneCount / 10);
      oneCount %= 10;
      tenCount += newTenFromOnes;

      const newHundredFromTens = Math.floor(tenCount / 10);
      tenCount %= 10;
      hundredCount += newHundredFromTens;

      for (let i = 0; i < hundredCount; i += 1) {
        nextBlocks.push({ id: `h-${cid}-${i}`, type: 'hundred', containerId: cid });
      }
      for (let i = 0; i < tenCount; i += 1) {
        nextBlocks.push({ id: `t-${cid}-${i}`, type: 'ten', containerId: cid });
      }
      for (let i = 0; i < oneCount; i += 1) {
        nextBlocks.push({ id: `o-${cid}-${i}`, type: 'one', containerId: cid });
      }
    });

    setCurrentBlocks(nextBlocks);
    setToolMode('none');
  };

  const resetBlocksToStart = () => {
    // 히스토리 저장
    setCurrentHistory(prev => [...prev.slice(-19), currentBlocks]);
    
    setCurrentBlocks(createBlocks(problem.dividend));
    setToolMode('none');
  };

  const undoLastMove = () => {
    if (currentHistory.length === 0) return;
    
    // 마지막 상태로 복원
    const previousState = currentHistory[currentHistory.length - 1];
    setCurrentBlocks(previousState);
    
    // 히스토리에서 마지막 항목 제거
    setCurrentHistory(prev => prev.slice(0, -1));
  };

  const handleStartStep4 = () => {
    setStep3Completed(true);
    setStep4Started(true);
    const initialBlocks = createBlocks(problem.dividend);
    setBlocks4(initialBlocks);
    setHistory4([]); // 4단계 히스토리 초기화
    setToolMode('none');
  };

  const canShowStep2 = hasEquation;
  const canShowStep3 = hasEquation && estimateSubmitted;
  const isHammerMode = toolMode === 'hammer';

  // 드래그 감지 설정: 마우스·터치를 따로 인식하고, 조금 움직여야 드래그가 시작되게 함
  // (살짝 누르는 동작은 클릭으로 남겨 두어 망치 모드 등과 충돌하지 않도록)
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );
  
  const divisionSteps = useMemo(
    () => computeLongDivisionSteps(problem.dividend, problem.divisor),
    [problem.dividend, problem.divisor]
  );

  // 자릿수별 완료 체크
  const equalShareForType = (type) => {
    const total = currentBlocks.filter((b) => b.type === type).length;
    
    // 해당 타입의 블록이 없으면 해당 자리 계산이 완료된 것으로 처리
    if (total === 0) return true;
    
    const inSource = currentBlocks.filter((b) => b.type === type && b.containerId === 'source').length;
    const inPlates = total - inSource;
    
    // 접시에 있는 블록이 없으면 아직 시작 안 함
    if (inPlates === 0) return false;
    
    // 각 접시의 개수 확인
    const counts = Array.from({ length: problem.divisor }, (_, i) => {
      const items = byContainer.get(`plate-${i}`) ?? [];
      return items.filter((b) => b.type === type).length;
    });
    
    // 모든 접시에 똑같이 나누어져 있는지 확인
    const allEqual = counts.every((c) => c === counts[0]);
    if (!allEqual) return false;
    
    // 백 모형, 십 모형: source에 하나도 남으면 안 됨 (쪼개야 함)
    if (type === 'hundred' || type === 'ten') {
      return inSource === 0;
    }
    
    // 일 모형: source에 나머지가 나누는 수보다 적으면 완료
    return inSource < problem.divisor;
  };

  const hundredsDone = equalShareForType('hundred');
  const tensDone = equalShareForType('ten');
  const onesDone = equalShareForType('one');

  // 세로셈에서 완료된 단계 수 계산
  const completedSteps = useMemo(() => {
    const numDigits = String(problem.dividend).length;
    let completed = 0;
    
    // 3자리수인 경우: 백의 자리 → 십의 자리 → 일의 자리
    // 2자리수인 경우: 십의 자리 → 일의 자리
    if (numDigits === 3) {
      if (hundredsDone) completed = 1;
      if (hundredsDone && tensDone) completed = 2;
      if (hundredsDone && tensDone && onesDone) completed = 3;
    } else if (numDigits === 2) {
      if (tensDone) completed = 1;
      if (tensDone && onesDone) completed = 2;
    } else if (numDigits === 1) {
      if (onesDone) completed = 1;
    }
    
    return completed;
  }, [hundredsDone, tensDone, onesDone, problem.dividend]);

  const ToolBar = () => (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700">
      <button
        type="button"
        onClick={() => setToolMode((prev) => (prev === 'hammer' ? 'none' : 'hammer'))}
        className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs sm:text-sm font-semibold ${
          toolMode === 'hammer'
            ? 'bg-rose-200 border-rose-400 text-rose-800'
            : 'bg-white border-slate-300 hover:bg-slate-50'
        }`}
      >
        <span>🔨</span>
        <span>망치(쪼개기)</span>
      </button>
      <button
        type="button"
        onClick={handleMergeAll}
        className="flex items-center gap-1 px-3 py-1 rounded-full border bg-white border-slate-300 hover:bg-slate-50 text-xs sm:text-sm font-semibold"
      >
        <span>🧴</span>
        <span>풀(다시 합치기)</span>
      </button>
      <button
        type="button"
        onClick={resetBlocksToStart}
        className="flex items-center gap-1 px-3 py-1 rounded-full border bg-white border-slate-300 hover:bg-slate-50 text-xs sm:text-sm font-semibold"
      >
        <span>🔄</span>
        <span>초기화</span>
      </button>
      <button
        type="button"
        onClick={undoLastMove}
        disabled={currentHistory.length === 0}
        className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs sm:text-sm font-semibold ${
          currentHistory.length === 0
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-slate-300 hover:bg-slate-50'
        }`}
      >
        <span>↶</span>
        <span>되돌리기</span>
      </button>
      
      {/* 일괄 이동 입력창 */}
      <div className="flex items-center gap-2 ml-2 pl-2 sm:ml-4 sm:pl-4 border-l-2 border-slate-300">
        <input 
          type="number"
          value={batchCount}
          onChange={(e) => setBatchCount(Math.max(1, Number(e.target.value) || 1))}
          min="1"
          max="100"
          className="w-12 sm:w-14 px-2 py-1 border-2 border-sky-300 rounded-lg text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
        />
        <span className="font-semibold text-slate-700 whitespace-nowrap">개씩 이동</span>
      </div>
      
      <span className="ml-auto text-[11px] sm:text-xs text-slate-500">
        망치 모드에서는 100·10 모형을 클릭해서 더 작은 모형으로 쪼갤 수 있어요.
      </span>
    </div>
  );

  const ManipulativeArea = () => (
    <>
      <SourceArea
        blocks={byContainer.get('source') ?? []}
        onBlockClick={handleBlockClick}
        isHammerMode={isHammerMode}
      />

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center">
          <span className="text-sm sm:text-base font-semibold text-slate-800">
            나누는 수:{' '}
            <span className="text-xl sm:text-2xl font-extrabold text-sky-700">
              {problem.divisor}
            </span>{' '}
            개의 접시
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {perPlateCounts.map((plate, index) => (
            <Plate
              key={index}
              id={`plate-${index}`}
              label={`${index + 1}번 접시`}
              highlight={everySameAndCorrect && plate.total === quotient}
            >
              {plate.items.map((b) => (
                <Block
                  key={b.id}
                  id={b.id}
                  type={b.type}
                  onClick={handleBlockClick}
                  isHammerMode={isHammerMode}
                />
              ))}
              <div className="mt-2 text-xs sm:text-sm text-slate-700">
                합계:{' '}
                <span className="font-bold text-slate-900">
                  {plate.total}
                </span>
              </div>
            </Plate>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div
      className="rounded-3xl bg-white/80 shadow-xl border-4 border-pastelBlue/60 flex flex-col relative overflow-hidden"
      onMouseMove={(e) => {
        if (!isHammerMode) return;
        setCursorPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* 네비게이션 바 */}
      <nav className="bg-white border-b-2 border-pastelBlue/60 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <a 
          href="/index.html" 
          className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-800 hover:text-pastelBlue transition-colors"
        >
          <span className="w-10 h-10 bg-pastelBlue rounded-full flex items-center justify-center text-xl border-2 border-sky-400 shadow-md hover:scale-110 hover:bg-sky-300 transition-all">
            🏠
          </span>
          <img src="/image/head.png" alt="나눗셈 탐험대" className="h-[50px] object-contain" />
        </a>
        <div className="flex gap-2 flex-wrap">
          <a 
            href="/page1.html" 
            className="px-3 py-2 bg-pastelBlue border-2 border-sky-400 rounded-full text-xs sm:text-sm font-semibold text-slate-800 shadow-md transition-all hover:scale-105 whitespace-nowrap"
          >
            1단계: 수모형 탐구
          </a>
          <a 
            href="/page2.html" 
            className="px-3 py-2 bg-pastelBlue/20 border-2 border-transparent rounded-full text-xs sm:text-sm font-semibold text-slate-800 transition-all hover:bg-pastelBlue/40 hover:scale-105 whitespace-nowrap"
          >
            2단계: 실생활 문제
          </a>
          <a 
            href="/page3.html" 
            className="px-3 py-2 bg-pastelBlue/20 border-2 border-transparent rounded-full text-xs sm:text-sm font-semibold text-slate-800 transition-all hover:bg-pastelBlue/40 hover:scale-105 whitespace-nowrap"
          >
            3단계: 문제 만들기
          </a>
        </div>
      </nav>

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-pastelBlue via-pastelPurple to-pastelPink px-5 py-4 sm:px-8 sm:py-5 text-center relative">
        <h1 className="text-[1.4rem] sm:text-[1.75rem] font-extrabold text-slate-800" style={{ textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)' }}>
          수모형으로 활동하며 탐구하기
        </h1>
      </div>

      {/* 상단: 문제 제시 + 식 입력 */}
      <div className="bg-gradient-to-r from-pastelBlue/30 via-pastelPurple/20 to-pastelPink/30 px-5 py-4 sm:px-8 sm:py-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-xl">
            <p className="text-xs sm:text-sm font-semibold text-sky-900/80">
              오늘의 나눗셈 활동
            </p>
            <p className="mt-1 text-sm sm:text-lg font-semibold text-sky-950">
              선생님이 들려주는 실생활 문제를 잘 듣고, 알맞은 나눗셈 식을 아래 빈 칸에 세워 보세요.
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-sky-900/80">
              선생님이 예: "사탕 68개를 2명의 친구에게 똑같이 나누어 주려고 합니다." 와 같이 문제를 말해 주실 거예요.
            </p>
          </div>
        </div>

        <div className="bg-white/90 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3">
          <p className="text-sm sm:text-base font-semibold text-slate-800">
            1단계. 문장을 보고 알맞은 나눗셈 식을 세워 보세요.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input
                type="number"
                className="w-20 sm:w-24 rounded-xl border-2 border-pastelBlue px-2 py-2 text-lg sm:text-2xl font-bold text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:bg-slate-100"
                placeholder="?"
                value={equationDividend}
                onChange={(e) => setEquationDividend(e.target.value)}
              />
              <span className="text-xl sm:text-3xl font-extrabold text-slate-800">÷</span>
              <input
                type="number"
                className="w-20 sm:w-24 rounded-xl border-2 border-pastelBlue px-2 py-2 text-lg sm:text-2xl font-bold text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:bg-slate-100"
                placeholder="?"
                value={equationDivisor}
                onChange={(e) => setEquationDivisor(e.target.value)}
              />
              <span className="text-xl sm:text-3xl font-extrabold text-slate-800">= ?</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs sm:text-sm text-slate-600">
                힌트: 전체 수를 앞 칸에, 나누는 사람(또는 칸)의 수를 뒤 칸에 써 보세요.
              </p>
            </div>
          </div>
        </div>

        {canShowStep2 && (
          <div className="bg-white/90 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3">
            <p className="text-sm sm:text-base font-semibold text-slate-800">
              2단계. 몫이 얼마일지 어림해 보세요.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <input
                  type="number"
                  className="w-24 sm:w-28 rounded-xl border-2 border-pastelBlue px-3 py-2 text-lg sm:text-2xl font-bold text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                  placeholder="?"
                  value={estimate}
                  onChange={(e) => {
                    setEstimate(e.target.value);
                    setEstimateSubmitted(false);
                  }}
                />
                <span className="text-sm sm:text-base text-slate-700">이라고 어림했어요.</span>
                <button
                  type="button"
                  onClick={handleEstimateSubmit}
                  className="px-4 py-2 rounded-xl text-base sm:text-lg font-bold shadow bg-amber-400 text-amber-950 hover:bg-amber-500 active:scale-95 transition"
                >
                  어림하기 확인
                </button>
              </div>
              {estimateError && (
                <p className="text-xs sm:text-sm text-rose-600 font-semibold">
                  {estimateError}
                </p>
              )}
              <div className="mt-1 rounded-xl border-2 border-slate-300 bg-slate-50/80 px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm sm:text-base font-semibold text-slate-700">AI 피드백</p>
                  {hasApiKey ? (
                    <span className="text-xs sm:text-sm text-emerald-600 font-medium">🟢 AI 연결됨</span>
                  ) : (
                    <span className="text-xs sm:text-sm text-rose-500 font-medium">🔴 API Key 없음</span>
                  )}
                </div>
                <div className="min-h-[64px] sm:min-h-[80px] rounded-lg bg-white/80 border border-dashed border-slate-300 flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4 text-sm sm:text-base">
                  {aiFeedbackLoading ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin" />
                      <span>AI 선생님이 피드백을 작성 중이에요...</span>
                    </div>
                  ) : aiFeedback ? (
                    <p className="text-slate-700 text-center leading-relaxed font-medium">{aiFeedback}</p>
                  ) : hasApiKey ? (
                    <p className="text-slate-400">어림하기 확인을 누르면 AI 선생님이 피드백을 줄 거예요!</p>
                  ) : (
                    <p className="text-slate-400">.env 파일에 VITE_OPENAI_API_KEY를 설정하면 AI 피드백을 받을 수 있어요.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단: 수모형 조작 & 세로셈 연결 */}
      {canShowStep2 && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 flex flex-col gap-4 sm:gap-5">
          
          {/* 3단계 */}
          {!step4Started && (
            <>
              <p className="text-sm sm:text-base font-semibold text-slate-800">
                3단계. 수모형을 끌어서 아래 접시에 똑같이 나누어 담아 보세요.
              </p>
              
              {/* 문제 다시 보기 */}
              <div className="rounded-xl bg-sky-50/80 border-2 border-sky-200 px-4 py-3 flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm font-semibold text-sky-800">문제:</span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900">{equationDividend}</span>
                  <span className="text-lg sm:text-xl font-bold text-sky-700">÷</span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-900">{equationDivisor}</span>
                  <span className="text-lg sm:text-xl font-bold text-sky-700">= ?</span>
                </div>
              </div>

              {canShowStep3 ? (
                <>
                  <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
                    <ToolBar />
                    <ManipulativeArea />

                    <div className="mt-2 rounded-2xl bg-white/90 border-2 border-pastelGreen px-4 py-3 flex flex-col gap-1">
                      {everySameAndCorrect ? (
                        <>
                          <p className="text-lg sm:text-xl font-extrabold text-emerald-700">
                            완벽해요! 🎉
                          </p>
                          <p className="text-sm sm:text-base text-slate-800">
                            모든 접시에 <span className="font-bold">{quotient}</span>씩 똑같이 나누어 담았어요.
                            {remainder > 0 ? (
                              <>
                                {' '}그리고 나머지는 <span className="font-bold text-amber-600">{remainder}</span>개예요.
                                {' '}그래서{' '}
                                <span className="font-bold">
                                  {problem.dividend} ÷ {problem.divisor} = {quotient} 나머지 {remainder}
                                </span>{' '}
                                입니다.
                              </>
                            ) : (
                              <>
                                {' '}그래서{' '}
                                <span className="font-bold">
                                  {problem.dividend} ÷ {problem.divisor} = {quotient}
                                </span>{' '}
                                입니다.
                              </>
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={handleStartStep4}
                            className="mt-2 px-4 py-2 rounded-xl text-base sm:text-lg font-bold shadow bg-pastelBlue text-sky-900 hover:bg-sky-200 active:scale-95 transition self-start"
                          >
                            4단계로 가기 →
                          </button>
                        </>
                      ) : (
                        <>
                          {perPlateCounts.every((p) => p.total === quotient) && perPlateCounts.length > 0 ? (
                            <p className="text-sm sm:text-base text-amber-800">
                              접시에는 똑같이 나누어졌어요! {remainder > 0 && `하지만 수모형 상자에 나머지 ${remainder}개가 정확히 남아있는지 확인해 보세요.`}
                            </p>
                          ) : sourceTotal === remainder && sourceTotal < problem.divisor ? (
                            <p className="text-sm sm:text-base text-amber-800">
                              나머지는 잘 남겨두었어요! 이제 각 접시에 {quotient}씩 똑같이 나누어 담아 보세요.
                            </p>
                          ) : (
                            <p className="text-sm sm:text-base text-slate-800">
                              수모형을 접시에 똑같이 나누어 담아 보세요. {remainder > 0 && `나누어 떨어지지 않으면 나머지를 수모형 상자에 남겨두세요.`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </DndContext>
                </>
              ) : (
                <div className="mt-2 rounded-2xl bg-white/70 border-2 border-dashed border-pastelBlue px-4 py-4 text-sm sm:text-base text-slate-600 flex flex-col gap-1">
                  <p className="font-semibold text-slate-700">
                    먼저 2단계에서 몫을 어림해 본 뒤, 3단계에서 수모형을 이용해 실제로 나누어 볼 수 있어요.
                  </p>
                  <p>
                    어림하기를 마치면, 이 아래에서 수모형을 직접 끌어서 나누어 보고,
                    세로셈과도 연결해 볼 수 있어요.
                  </p>
                </div>
              )}
            </>
          )}

          {/* 4단계 */}
          {step4Started && (
            <div className="flex flex-col gap-3 sm:gap-4">
              <p className="text-sm sm:text-base font-semibold text-slate-800">
                4단계. 수모형을 자릿값으로 묶어서 세로셈과 연결해 보세요.
              </p>

              <div className="flex flex-col lg:flex-row gap-4">
                {/* 왼쪽: 수모형 조작 영역 */}
                <div className="flex-1 rounded-2xl border-2 border-pastelPink bg-white/90 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3">
                  <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
                    <ToolBar />
                    <ManipulativeArea />
                  </DndContext>
                </div>

                {/* 오른쪽: 세로셈 표 형식 */}
                <div className="w-full lg:min-w-[400px] lg:w-auto flex-shrink-0 rounded-2xl border-2 border-pastelBlue bg-white/90 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3 max-w-full">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                    세로셈
                  </p>
                  
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-5 sm:px-5">
                    <div style={{ minWidth: 'max-content' }}>
                      <LongDivisionGrid
                        dividend={problem.dividend}
                        divisor={problem.divisor}
                        steps={divisionSteps}
                        completedSteps={completedSteps}
                      />
                    </div>
                  </div>

                  {/* 완료 피드백 */}
                  {everySameAndCorrect && (
                    <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-2">
                      <p className="text-sm font-bold text-emerald-700">🎉 세로셈 완성!</p>
                      <p className="text-xs text-slate-700">
                        {problem.dividend} ÷ {problem.divisor} = {quotient}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {isHammerMode && (
        <div
          className="pointer-events-none fixed z-50 text-xl sm:text-2xl"
          style={{ left: cursorPos.x + 2, top: cursorPos.y + 10 }}
        >
          🔨
        </div>
      )}
    </div>
  );
};

export default App;
