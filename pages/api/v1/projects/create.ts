import { NextApiRequest, NextApiResponse } from "next";
import { ProjectModel, UserModel } from "../../../../models";
import { validateToken } from "../../../../middlewares/jwt";
import Request from "../../../../utils/Request"

export default validateToken(async function Create (req:Request, res:NextApiResponse) {
    if(req.method !== 'POST') return res.status(405).send({status:405, message: 'only POST request allowed'});
    
    await validateInput(req.body)
    .then(async ()=> {
        const { title, desc, team } = req.body;
        const newTeam:any = [];
        var teamMod = [req.user.email, ...team];

        console.log(teamMod);

        for (var i=0; i < teamMod.length; i++) {
            // search for user data and get user ID
            UserModel.findOne({email: teamMod[i]})
            .then((foundUser)=> {
                newTeam.push(foundUser.id);

                if(i === teamMod.length) {
                    ProjectModel.create({
                        title: title.toLowerCase(),
                        desc: desc.toLowerCase(),
                        team: newTeam,
                        createdBy: req.user._id.toString()
                    })
                    .then(async (createdProject)=> {
                        console.log(createdProject)

                        for(var index=0; index < createdProject.team.length; index++) {
                            const teamMemId = createdProject.team[index],
                            projectId = createdProject.id.toString();

                            if(teamMemId === req.user._id) {
                                // save project data in creator profile
                                UserModel.findOneAndUpdate(
                                    { _id: teamMemId },
                                    {  
                                        $set: { 'projects.recent': projectId },
                                        $push: { 
                                            'projects.created': projectId,
                                            'projects.assigned': projectId
                                        }
                                    },
                                    { new: true }
                                ).then((updatedUserData)=> {
                                    console.log('User profile updated with new project data', teamMemId);
                                    
                                    if(index === createdProject.team.length) {
                                        return res.status(200).send({ message: 'New project created successfully', user: updatedUserData })
                                    }
                                })
                            }

                            if(teamMemId != req.user._id) {
                                // save project data in assignee's profile
                                UserModel.findOneAndUpdate(
                                    { _id: teamMemId },
                                    {  
                                        $push: { 
                                            'projects.assigned': projectId
                                        }
                                    },
                                    { new: true }
                                ).then(()=> {
                                    console.log('New Project assigned to user', teamMemId);
                                    
                                    if(index === createdProject.team.length) {
                                        UserModel.findOne({_id: req.user._id})
                                        .then((userData)=> res.status(200).send({ message: 'New project created successfully', user: userData }))
                                    }
                                })
                            }   
                        }

                        if(createdProject.team.length === 0) {
                            UserModel.findOne({_id: req.user._id})
                            .then((updatedUser)=> res.status(200).send({ message: 'New project created successfully', user: updatedUser }))
                            .catch((error)=> {
                                console.error('There was an error fetching user', error);
                                return res.status(500).send({status:500, message: 'There was an error fetching user', error: error});
                            })
                        }
                    })
                    .catch((error)=> {
                        return res.status(500).send({status:500, message: 'There was an error creating user', error: error});
                    });           
                }
            })
            .catch((error)=> {
                console.error(error);
                return res.status(500).send({ message: "There was an error finding user, try again" });
            })
        }
    })
    .catch((validationErr:any)=> res.status(422).send({status: 422, message: validationErr.message}));
});

const validateInput = (data:any)=> {
    return new Promise((resolve, reject)=> {        
        if(Object.keys(data).length ===  0) return false;
        if(!data.title) reject({ status: false, message: "Title field cannot be empty" });
        if(!data.desc) reject({ status: false, message: "Description field cannot be empty" });

        resolve({status: true, message: "SUCCESS"});
    })
}