import React from 'react';
import { BookOpen, GraduationCap, Atom, FileText, Video } from 'lucide-react';

export const EducationalWatermark: React.FC = () => {
  return (
    <div className="educamp-watermark-pattern" aria-hidden="true">
      {/* Top Left: Book */}
      <div className="watermark-icon" style={{ top: '6%', left: '8%', transform: 'rotate(-12deg)' }}>
        <BookOpen size={48} />
      </div>

      {/* Top Right: Graduation Cap */}
      <div className="watermark-icon" style={{ top: '8%', right: '10%', transform: 'rotate(15deg)' }}>
        <GraduationCap size={56} />
      </div>

      {/* Mid Right: Chemistry Atom */}
      <div className="watermark-icon" style={{ top: '24%', right: '6%', transform: 'rotate(25deg)' }}>
        <Atom size={52} />
      </div>

      {/* Mid Left: Document / Notes */}
      <div className="watermark-icon" style={{ top: '34%', left: '6%', transform: 'rotate(-18deg)' }}>
        <FileText size={44} />
      </div>

      {/* Lower Left: Video Clapper */}
      <div className="watermark-icon" style={{ top: '60%', left: '7%', transform: 'rotate(10deg)' }}>
        <Video size={46} />
      </div>

      {/* Lower Right: Book Open */}
      <div className="watermark-icon" style={{ top: '78%', right: '8%', transform: 'rotate(-15deg)' }}>
        <GraduationCap size={54} />
      </div>

      {/* Bottom Left: Note Page */}
      <div className="watermark-icon" style={{ bottom: '10%', left: '10%', transform: 'rotate(8deg)' }}>
        <FileText size={42} />
      </div>
    </div>
  );
};
