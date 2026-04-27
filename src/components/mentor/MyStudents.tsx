import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  full_name?: string;
  email: string;
  created_at: string;
}

export const MyStudents = ({ students }: { students: Student[] }) => {
  return (
    <div className="space-y-4">
      {students.map((student) => (
        <Card key={student.id}>
          <CardHeader>
            <CardTitle>{student.full_name || student.email}</CardTitle>
            <Badge variant="outline">Student</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Joined: {new Date(student.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};